import { HostProvider } from "@/hosts/host-provider"
import { ShowMessageType } from "@/shared/proto/host/window"

export interface CostAlert {
	type: "warning" | "limit_exceeded"
	category: "session" | "daily" | "rate"
	message: string
	currentValue: number
	limit: number
	threshold?: number
}

export class CostAlertService {
	private static instance: CostAlertService
	private lastAlertTimes: Map<string, number> = new Map()
	private readonly ALERT_COOLDOWN_MS = 60000 // 1 minute cooldown between similar alerts

	private constructor() {}

	public static getInstance(): CostAlertService {
		if (!CostAlertService.instance) {
			CostAlertService.instance = new CostAlertService()
		}
		return CostAlertService.instance
	}

	public showCostWarning(alert: CostAlert): void {
		const alertKey = `${alert.type}_${alert.category}`
		const now = Date.now()
		const lastAlert = this.lastAlertTimes.get(alertKey)

		// Check cooldown
		if (lastAlert && now - lastAlert < this.ALERT_COOLDOWN_MS) {
			return
		}

		this.lastAlertTimes.set(alertKey, now)

		const percentage = Math.round((alert.currentValue / alert.limit) * 100)
		
		let message: string
		let type: ShowMessageType

		switch (alert.type) {
			case "warning":
				type = ShowMessageType.WARNING
				if (alert.category === "session") {
					message = `⚠️ Session cost warning: $${alert.currentValue.toFixed(2)} (${percentage}% of $${alert.limit.toFixed(2)} limit)`
				} else if (alert.category === "daily") {
					message = `⚠️ Daily cost warning: $${alert.currentValue.toFixed(2)} (${percentage}% of $${alert.limit.toFixed(2)} limit)`
				} else {
					message = `⚠️ Rate limit warning: ${alert.currentValue} requests (${percentage}% of ${alert.limit} limit)`
				}
				break

			case "limit_exceeded":
				type = ShowMessageType.ERROR
				if (alert.category === "session") {
					message = `🚫 Session cost limit exceeded: $${alert.currentValue.toFixed(2)} / $${alert.limit.toFixed(2)}. New requests will be blocked.`
				} else if (alert.category === "daily") {
					message = `🚫 Daily cost limit exceeded: $${alert.currentValue.toFixed(2)} / $${alert.limit.toFixed(2)}. New requests will be blocked until tomorrow.`
				} else {
					message = `🚫 Rate limit exceeded: ${alert.currentValue} / ${alert.limit} requests per minute. Please wait before making new requests.`
				}
				break
		}

		// Show VS Code notification
		HostProvider.window.showMessage({
			type,
			message,
		})

		console.log("Cost alert:", alert)
	}

	public showRateLimitExceeded(data: { type: string; limit?: number; current?: number; delay?: number; remaining?: number }): void {
		const now = Date.now()
		const alertKey = `rate_limit_${data.type}`
		const lastAlert = this.lastAlertTimes.get(alertKey)

		// Check cooldown
		if (lastAlert && now - lastAlert < this.ALERT_COOLDOWN_MS) {
			return
		}

		this.lastAlertTimes.set(alertKey, now)

		let message: string
		if (data.type === "requestsPerMinute") {
			message = `🚫 Rate limit exceeded: ${data.current}/${data.limit} requests per minute. Please wait before making new requests.`
		} else if (data.type === "delayBetweenRequests") {
			const secondsRemaining = Math.ceil((data.remaining || 0) / 1000)
			message = `⏱️ Request too soon. Please wait ${secondsRemaining} seconds before next request.`
		} else {
			message = `🚫 Rate limit exceeded. Please wait before making new requests.`
		}

		HostProvider.window.showMessage({
			type: ShowMessageType.WARNING,
			message,
		})
	}

	public showCostLimitExceeded(data: { type: string; limit: number; current: number }): void {
		const alert: CostAlert = {
			type: "limit_exceeded",
			category: data.type as "session" | "daily",
			message: "",
			currentValue: data.current,
			limit: data.limit,
		}

		this.showCostWarning(alert)
	}

	public showCostWarningThreshold(data: { type: string; threshold: number; current: number; limit: number }): void {
		const alert: CostAlert = {
			type: "warning",
			category: data.type as "session" | "daily",
			message: "",
			currentValue: data.current,
			limit: data.limit,
			threshold: data.threshold,
		}

		this.showCostWarning(alert)
	}

	public resetCooldowns(): void {
		this.lastAlertTimes.clear()
	}
}