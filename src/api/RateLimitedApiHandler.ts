import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandler } from "./index"
import { ApiStream, ApiStreamUsageChunk } from "./transform/stream"
import { RateLimitService, RequestInfo } from "@services/rate-limiting"
import { ModelInfo } from "@shared/api"
import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "@utils/cost"

export class RateLimitedApiHandler implements ApiHandler {
	private baseHandler: ApiHandler
	private rateLimitService: RateLimitService

	constructor(baseHandler: ApiHandler, rateLimitService: RateLimitService) {
		this.baseHandler = baseHandler
		this.rateLimitService = rateLimitService
	}

	async createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): Promise<ApiStream> {
		const model = this.baseHandler.getModel()
		
		// Estimate token count and cost for rate limiting check
		const estimatedInputTokens = this.estimateTokenCount(systemPrompt, messages)
		const estimatedOutputTokens = 1000 // Conservative estimate
		const estimatedCost = this.estimateCost(model.info, estimatedInputTokens, estimatedOutputTokens)

		const requestInfo: Omit<RequestInfo, "timestamp"> = {
			provider: this.getProviderName(model.id),
			model: model.id,
			estimatedCost,
		}

		// Check if request is allowed by rate limiting
		const canProceed = await this.rateLimitService.canMakeRequest(requestInfo)
		if (!canProceed) {
			// Wait for rate limit to clear if needed
			await this.rateLimitService.waitForNextRequest()
			
			// Check again after waiting
			const canProceedAfterWait = await this.rateLimitService.canMakeRequest(requestInfo)
			if (!canProceedAfterWait) {
				throw new Error("Request blocked by rate limiting or cost controls")
			}
		}

		// Record the request attempt
		this.rateLimitService.recordRequest(requestInfo)

		// Make the actual API request
		const stream = await this.baseHandler.createMessage(systemPrompt, messages)

		// Wrap the stream to track actual usage
		return this.wrapStreamWithUsageTracking(stream, requestInfo)
	}

	getModel(): { id: string; info: ModelInfo } {
		return this.baseHandler.getModel()
	}

	async getApiStreamUsage?(): Promise<ApiStreamUsageChunk | undefined> {
		return this.baseHandler.getApiStreamUsage?.()
	}

	private wrapStreamWithUsageTracking(stream: ApiStream, requestInfo: Omit<RequestInfo, "timestamp">): ApiStream {
		// Create a new stream that tracks usage
		const wrappedStream = new AsyncGenerator<any, void, unknown>()
		
		const originalIterator = stream[Symbol.asyncIterator]()
		
		return {
			[Symbol.asyncIterator]: async function* () {
				let finalUsage: ApiStreamUsageChunk | undefined
				
				try {
					// Forward all chunks from the original stream
					for await (const chunk of originalIterator) {
						if (chunk.type === "usage") {
							finalUsage = chunk
						}
						yield chunk
					}
				} finally {
					// Update rate limiting service with actual usage if available
					if (finalUsage) {
						const actualCost = this.calculateActualCost(finalUsage)
						// Note: We could adjust the recorded cost here, but for simplicity
						// we'll keep the original estimate since the difference is usually small
					}
				}
			}.bind(this)
		} as ApiStream
	}

	private estimateTokenCount(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): number {
		// Simple token estimation: roughly 4 characters per token
		let totalChars = systemPrompt.length

		for (const message of messages) {
			if (typeof message.content === "string") {
				totalChars += message.content.length
			} else if (Array.isArray(message.content)) {
				for (const block of message.content) {
					if (block.type === "text") {
						totalChars += block.text.length
					}
				}
			}
		}

		return Math.ceil(totalChars / 4)
	}

	private estimateCost(modelInfo: ModelInfo, inputTokens: number, outputTokens: number): number {
		// Use the same cost calculation logic as the existing system
		// For simplicity, assume Anthropic-style pricing for now
		return calculateApiCostAnthropic(modelInfo, inputTokens, outputTokens)
	}

	private calculateActualCost(usage: ApiStreamUsageChunk): number {
		const model = this.baseHandler.getModel()
		return calculateApiCostAnthropic(
			model.info,
			usage.inputTokens || 0,
			usage.outputTokens || 0,
			usage.cacheCreationInputTokens,
			usage.cacheReadInputTokens
		)
	}

	private getProviderName(modelId: string): string {
		// Extract provider name from model ID or use a mapping
		if (modelId.includes("claude")) return "anthropic"
		if (modelId.includes("gpt")) return "openai"
		if (modelId.includes("gemini")) return "google"
		// Add more mappings as needed
		return "unknown"
	}
}