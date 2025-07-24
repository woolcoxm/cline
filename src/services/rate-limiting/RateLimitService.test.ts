import { RateLimitService, DEFAULT_RATE_LIMIT_SETTINGS, RateLimitSettings } from "./RateLimitService"

describe("RateLimitService", () => {
	let rateLimitService: RateLimitService

	beforeEach(() => {
		const testSettings: RateLimitSettings = {
			enabled: true,
			requestsPerMinute: 5,
			delayBetweenRequests: 1000, // 1 second
			maxCostPerSession: 1.0, // $1
			maxCostPerDay: 5.0, // $5
			warningThreshold: 80, // 80%
		}
		rateLimitService = new RateLimitService(testSettings)
	})

	afterEach(() => {
		rateLimitService.removeAllListeners()
	})

	describe("Request Rate Limiting", () => {
		it("should allow requests within rate limit", async () => {
			const requestInfo = {
				provider: "anthropic",
				model: "claude-3-sonnet",
				estimatedCost: 0.01,
			}

			const canMakeRequest = await rateLimitService.canMakeRequest(requestInfo)
			expect(canMakeRequest).toBe(true)
		})

		it("should block requests exceeding rate limit", async () => {
			const requestInfo = {
				provider: "anthropic",
				model: "claude-3-sonnet",
				estimatedCost: 0.01,
			}

			// Make 5 requests (the limit)
			for (let i = 0; i < 5; i++) {
				rateLimitService.recordRequest(requestInfo)
			}

			// 6th request should be blocked
			const canMakeRequest = await rateLimitService.canMakeRequest(requestInfo)
			expect(canMakeRequest).toBe(false)
		})

		it("should respect delay between requests", async () => {
			const requestInfo = {
				provider: "anthropic",
				model: "claude-3-sonnet",
				estimatedCost: 0.01,
			}

			// Record a request
			rateLimitService.recordRequest(requestInfo)

			// Immediate next request should be blocked due to delay
			const canMakeRequestImmediately = await rateLimitService.canMakeRequest(requestInfo)
			expect(canMakeRequestImmediately).toBe(false)

			// Wait for delay to pass
			await new Promise((resolve) => setTimeout(resolve, 1100))

			// Now request should be allowed
			const canMakeRequestAfterDelay = await rateLimitService.canMakeRequest(requestInfo)
			expect(canMakeRequestAfterDelay).toBe(true)
		})
	})

	describe("Cost Limiting", () => {
		it("should block requests exceeding session cost limit", async () => {
			const expensiveRequest = {
				provider: "anthropic",
				model: "claude-3-sonnet",
				estimatedCost: 1.5, // Exceeds $1 session limit
			}

			const canMakeRequest = await rateLimitService.canMakeRequest(expensiveRequest)
			expect(canMakeRequest).toBe(false)
		})

		it("should block requests exceeding daily cost limit", async () => {
			const expensiveRequest = {
				provider: "anthropic",
				model: "claude-3-sonnet",
				estimatedCost: 6.0, // Exceeds $5 daily limit
			}

			const canMakeRequest = await rateLimitService.canMakeRequest(expensiveRequest)
			expect(canMakeRequest).toBe(false)
		})

		it("should emit cost warnings at threshold", (done) => {
			const requestInfo = {
				provider: "anthropic",
				model: "claude-3-sonnet",
				estimatedCost: 0.85, // 85% of $1 session limit, above 80% threshold
			}

			rateLimitService.on("costWarning", (data) => {
				expect(data.type).toBe("session")
				expect(data.threshold).toBe(80)
				done()
			})

			rateLimitService.canMakeRequest(requestInfo)
		})
	})

	describe("Status Reporting", () => {
		it("should report correct status", () => {
			const requestInfo = {
				provider: "anthropic",
				model: "claude-3-sonnet",
				estimatedCost: 0.25,
			}

			// Record some requests
			rateLimitService.recordRequest(requestInfo)
			rateLimitService.recordRequest(requestInfo)

			const status = rateLimitService.getStatus()
			expect(status.requestsInCurrentMinute).toBe(2)
			expect(status.currentSessionCost).toBe(0.5)
			expect(status.currentDayCost).toBe(0.5)
		})
	})

	describe("Settings Updates", () => {
		it("should update settings correctly", () => {
			const newSettings = {
				requestsPerMinute: 10,
				maxCostPerSession: 2.0,
			}

			rateLimitService.updateSettings(newSettings)
			const settings = rateLimitService.getSettings()
			
			expect(settings.requestsPerMinute).toBe(10)
			expect(settings.maxCostPerSession).toBe(2.0)
			// Other settings should remain unchanged
			expect(settings.delayBetweenRequests).toBe(1000)
		})
	})

	describe("Disabled State", () => {
		it("should allow all requests when disabled", async () => {
			rateLimitService.updateSettings({ enabled: false })

			const expensiveRequest = {
				provider: "anthropic",
				model: "claude-3-sonnet",
				estimatedCost: 100.0, // Way over any limit
			}

			const canMakeRequest = await rateLimitService.canMakeRequest(expensiveRequest)
			expect(canMakeRequest).toBe(true)
		})
	})
})