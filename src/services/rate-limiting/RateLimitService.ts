import { EventEmitter } from "events"

export interface RateLimitSettings {
	enabled: boolean
	requestsPerMinute: number
	delayBetweenRequests: number // milliseconds
	maxCostPerSession: number // USD
	maxCostPerDay: number // USD
	warningThreshold: number // percentage (0-100)
}

export interface RateLimitStatus {
	requestsInCurrentMinute: number
	currentSessionCost: number
	currentDayCost: number
	isRateLimited: boolean
	timeUntilNextRequest: number // milliseconds
}

export interface RequestInfo {
	provider: string
	model: string
	estimatedCost: number
	timestamp: number
}

export class RateLimitService extends EventEmitter {
	private settings: RateLimitSettings
	private requestHistory: RequestInfo[] = []
	private lastRequestTime: number = 0
	private sessionStartTime: number = Date.now()
	private dailyCostHistory: Map<string, number> = new Map() // date -> cost

	constructor(settings: RateLimitSettings) {
		super()
		this.settings = settings
		this.loadDailyCostHistory()
	}

	public updateSettings(newSettings: Partial<RateLimitSettings>): void {
		this.settings = { ...this.settings, ...newSettings }
		this.emit("settingsUpdated", this.settings)
	}

	public async canMakeRequest(requestInfo: Omit<RequestInfo, "timestamp">): Promise<boolean> {
		if (!this.settings.enabled) {
			return true
		}

		const now = Date.now()
		const status = this.getStatus()

		// Check rate limit (requests per minute)
		if (status.requestsInCurrentMinute >= this.settings.requestsPerMinute) {
			this.emit("rateLimitExceeded", {
				type: "requestsPerMinute",
				limit: this.settings.requestsPerMinute,
				current: status.requestsInCurrentMinute,
			})
			return false
		}

		// Check minimum delay between requests
		const timeSinceLastRequest = now - this.lastRequestTime
		if (timeSinceLastRequest < this.settings.delayBetweenRequests) {
			this.emit("rateLimitExceeded", {
				type: "delayBetweenRequests",
				delay: this.settings.delayBetweenRequests,
				remaining: this.settings.delayBetweenRequests - timeSinceLastRequest,
			})
			return false
		}

		// Check session cost limit
		const projectedSessionCost = status.currentSessionCost + requestInfo.estimatedCost
		if (projectedSessionCost > this.settings.maxCostPerSession) {
			this.emit("costLimitExceeded", {
				type: "session",
				limit: this.settings.maxCostPerSession,
				current: projectedSessionCost,
			})
			return false
		}

		// Check daily cost limit
		const projectedDayCost = status.currentDayCost + requestInfo.estimatedCost
		if (projectedDayCost > this.settings.maxCostPerDay) {
			this.emit("costLimitExceeded", {
				type: "daily",
				limit: this.settings.maxCostPerDay,
				current: projectedDayCost,
			})
			return false
		}

		// Check warning thresholds
		const sessionWarningThreshold = (this.settings.maxCostPerSession * this.settings.warningThreshold) / 100
		const dailyWarningThreshold = (this.settings.maxCostPerDay * this.settings.warningThreshold) / 100

		if (projectedSessionCost >= sessionWarningThreshold && status.currentSessionCost < sessionWarningThreshold) {
			this.emit("costWarning", {
				type: "session",
				threshold: this.settings.warningThreshold,
				current: projectedSessionCost,
				limit: this.settings.maxCostPerSession,
			})
		}

		if (projectedDayCost >= dailyWarningThreshold && status.currentDayCost < dailyWarningThreshold) {
			this.emit("costWarning", {
				type: "daily",
				threshold: this.settings.warningThreshold,
				current: projectedDayCost,
				limit: this.settings.maxCostPerDay,
			})
		}

		return true
	}

	public async waitForNextRequest(): Promise<void> {
		const status = this.getStatus()
		if (status.timeUntilNextRequest > 0) {
			await new Promise((resolve) => setTimeout(resolve, status.timeUntilNextRequest))
		}
	}

	public recordRequest(requestInfo: Omit<RequestInfo, "timestamp">): void {
		const now = Date.now()
		const fullRequestInfo: RequestInfo = {
			...requestInfo,
			timestamp: now,
		}

		this.requestHistory.push(fullRequestInfo)
		this.lastRequestTime = now

		// Update daily cost tracking
		const today = this.getDateKey(now)
		const currentDayCost = this.dailyCostHistory.get(today) || 0
		this.dailyCostHistory.set(today, currentDayCost + requestInfo.estimatedCost)

		// Clean up old history (keep only last 24 hours for rate limiting, 30 days for cost tracking)
		this.cleanupHistory(now)
		this.saveDailyCostHistory()

		this.emit("requestRecorded", fullRequestInfo)
	}

	public getStatus(): RateLimitStatus {
		const now = Date.now()
		const oneMinuteAgo = now - 60 * 1000

		// Count requests in the last minute
		const requestsInCurrentMinute = this.requestHistory.filter((req) => req.timestamp > oneMinuteAgo).length

		// Calculate session cost
		const currentSessionCost = this.requestHistory
			.filter((req) => req.timestamp >= this.sessionStartTime)
			.reduce((sum, req) => sum + req.estimatedCost, 0)

		// Calculate daily cost
		const today = this.getDateKey(now)
		const currentDayCost = this.dailyCostHistory.get(today) || 0

		// Calculate time until next request
		const timeSinceLastRequest = now - this.lastRequestTime
		const timeUntilNextRequest = Math.max(0, this.settings.delayBetweenRequests - timeSinceLastRequest)

		const isRateLimited =
			requestsInCurrentMinute >= this.settings.requestsPerMinute ||
			timeUntilNextRequest > 0 ||
			currentSessionCost >= this.settings.maxCostPerSession ||
			currentDayCost >= this.settings.maxCostPerDay

		return {
			requestsInCurrentMinute,
			currentSessionCost,
			currentDayCost,
			isRateLimited,
			timeUntilNextRequest,
		}
	}

	public resetSession(): void {
		this.sessionStartTime = Date.now()
		this.emit("sessionReset")
	}

	private cleanupHistory(now: number): void {
		const oneDayAgo = now - 24 * 60 * 60 * 1000
		const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

		// Keep only last 24 hours for request history
		this.requestHistory = this.requestHistory.filter((req) => req.timestamp > oneDayAgo)

		// Keep only last 30 days for daily cost history
		for (const [dateKey, _] of this.dailyCostHistory) {
			const date = new Date(dateKey)
			if (date.getTime() < thirtyDaysAgo) {
				this.dailyCostHistory.delete(dateKey)
			}
		}
	}

	private getDateKey(timestamp: number): string {
		return new Date(timestamp).toISOString().split("T")[0]
	}

	private loadDailyCostHistory(): void {
		// In a real implementation, this would load from persistent storage
		// For now, we'll start with an empty history
	}

	private saveDailyCostHistory(): void {
		// In a real implementation, this would save to persistent storage
		// This will be implemented when integrating with the extension's storage system
	}

	public getSettings(): RateLimitSettings {
		return { ...this.settings }
	}

	public getDailyCostHistory(): Map<string, number> {
		return new Map(this.dailyCostHistory)
	}
}

// Default settings
export const DEFAULT_RATE_LIMIT_SETTINGS: RateLimitSettings = {
	enabled: false,
	requestsPerMinute: 50, // Conservative default
	delayBetweenRequests: 1000, // 1 second
	maxCostPerSession: 5.0, // $5 per session
	maxCostPerDay: 20.0, // $20 per day
	warningThreshold: 80, // 80% of limits
}