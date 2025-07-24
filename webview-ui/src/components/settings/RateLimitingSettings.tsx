import { memo, useCallback } from "react"
import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import styled from "styled-components"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useApiConfigurationHandlers } from "./utils/useApiConfigurationHandlers"
import Section from "./Section"

const Container = styled.div`
	display: flex;
	flex-direction: column;
	gap: 15px;
`

const FieldContainer = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
`

const Label = styled.label`
	font-weight: 500;
	font-size: 13px;
`

const Description = styled.p`
	font-size: 12px;
	margin: 0;
	color: var(--vscode-descriptionForeground);
	line-height: 1.4;
`

const FieldRow = styled.div`
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;

	@media (max-width: 500px) {
		grid-template-columns: 1fr;
	}
`

const WarningContainer = styled.div`
	background: var(--vscode-inputValidation-warningBackground);
	border: 1px solid var(--vscode-inputValidation-warningBorder);
	border-radius: 4px;
	padding: 12px;
	margin-top: 8px;
`

const WarningText = styled.p`
	margin: 0;
	color: var(--vscode-inputValidation-warningForeground);
	font-size: 12px;
	line-height: 1.4;
`

const InfoContainer = styled.div`
	background: var(--vscode-inputValidation-infoBackground);
	border: 1px solid var(--vscode-inputValidation-infoBorder);
	border-radius: 4px;
	padding: 12px;
	margin-top: 8px;
`

const InfoText = styled.p`
	margin: 0;
	color: var(--vscode-inputValidation-infoForeground);
	font-size: 12px;
	line-height: 1.4;
`

const RateLimitingSettings = () => {
	const { apiConfiguration } = useExtensionState()
	const { handleFieldChange } = useApiConfigurationHandlers()

	const isEnabled = apiConfiguration?.rateLimitEnabled ?? false
	const requestsPerMinute = apiConfiguration?.rateLimitRequestsPerMinute ?? 50
	const delayBetweenRequests = apiConfiguration?.rateLimitDelayBetweenRequests ?? 1000
	const maxCostPerSession = apiConfiguration?.rateLimitMaxCostPerSession ?? 5.0
	const maxCostPerDay = apiConfiguration?.rateLimitMaxCostPerDay ?? 20.0
	const warningThreshold = apiConfiguration?.rateLimitWarningThreshold ?? 80

	const handleToggle = useCallback((event: any) => {
		const checked = (event.target as HTMLInputElement).checked
		handleFieldChange("rateLimitEnabled", checked)
	}, [handleFieldChange])

	const handleRequestsPerMinuteChange = useCallback((event: any) => {
		const value = parseInt(event.target.value) || 0
		handleFieldChange("rateLimitRequestsPerMinute", value)
	}, [handleFieldChange])

	const handleDelayChange = useCallback((event: any) => {
		const value = parseInt(event.target.value) || 0
		handleFieldChange("rateLimitDelayBetweenRequests", value)
	}, [handleFieldChange])

	const handleMaxCostPerSessionChange = useCallback((event: any) => {
		const value = parseFloat(event.target.value) || 0
		handleFieldChange("rateLimitMaxCostPerSession", value)
	}, [handleFieldChange])

	const handleMaxCostPerDayChange = useCallback((event: any) => {
		const value = parseFloat(event.target.value) || 0
		handleFieldChange("rateLimitMaxCostPerDay", value)
	}, [handleFieldChange])

	const handleWarningThresholdChange = useCallback((event: any) => {
		const value = parseInt(event.target.value) || 0
		handleFieldChange("rateLimitWarningThreshold", Math.min(100, Math.max(0, value)))
	}, [handleFieldChange])

	return (
		<Section title="Rate Limiting & Cost Management">
			<Container>
				<FieldContainer>
					<VSCodeCheckbox checked={isEnabled} onChange={handleToggle}>
						Enable rate limiting and cost controls
					</VSCodeCheckbox>
					<Description>
						Prevent API rate limit errors and control spending by limiting request frequency and setting cost budgets.
					</Description>
				</FieldContainer>

				{isEnabled && (
					<>
						<InfoContainer>
							<InfoText>
								<strong>Why use rate limiting?</strong> Many API providers have strict rate limits, especially for free tiers. 
								These settings help you stay within limits and avoid costly mistakes during long coding sessions.
							</InfoText>
						</InfoContainer>

						<FieldRow>
							<FieldContainer>
								<Label htmlFor="requests-per-minute">Requests per minute</Label>
								<VSCodeTextField
									id="requests-per-minute"
									type="number"
									min="1"
									max="1000"
									value={requestsPerMinute.toString()}
									onChange={handleRequestsPerMinuteChange}
								/>
								<Description>
									Maximum API requests allowed per minute. Conservative: 10-30, Standard: 50-100
								</Description>
							</FieldContainer>

							<FieldContainer>
								<Label htmlFor="delay-between-requests">Delay between requests (ms)</Label>
								<VSCodeTextField
									id="delay-between-requests"
									type="number"
									min="0"
									max="10000"
									value={delayBetweenRequests.toString()}
									onChange={handleDelayChange}
								/>
								<Description>
									Minimum time to wait between API calls. 1000ms = 1 second
								</Description>
							</FieldContainer>
						</FieldRow>

						<FieldRow>
							<FieldContainer>
								<Label htmlFor="max-cost-session">Max cost per session ($)</Label>
								<VSCodeTextField
									id="max-cost-session"
									type="number"
									min="0"
									step="0.50"
									value={maxCostPerSession.toString()}
									onChange={handleMaxCostPerSessionChange}
								/>
								<Description>
									Maximum spending allowed in a single coding session
								</Description>
							</FieldContainer>

							<FieldContainer>
								<Label htmlFor="max-cost-day">Max cost per day ($)</Label>
								<VSCodeTextField
									id="max-cost-day"
									type="number"
									min="0"
									step="1.00"
									value={maxCostPerDay.toString()}
									onChange={handleMaxCostPerDayChange}
								/>
								<Description>
									Daily spending limit across all sessions
								</Description>
							</FieldContainer>
						</FieldRow>

						<FieldContainer>
							<Label htmlFor="warning-threshold">Warning threshold (%)</Label>
							<VSCodeTextField
								id="warning-threshold"
								type="number"
								min="0"
								max="100"
								value={warningThreshold.toString()}
								onChange={handleWarningThresholdChange}
							/>
							<Description>
								Show warnings when reaching this percentage of your cost limits
							</Description>
						</FieldContainer>

						{(maxCostPerSession > 20 || maxCostPerDay > 100) && (
							<WarningContainer>
								<WarningText>
									<strong>High cost limits detected.</strong> Consider starting with lower limits ($5 per session, $20 per day) 
									until you're familiar with your usage patterns.
								</WarningText>
							</WarningContainer>
						)}

						<InfoContainer>
							<InfoText>
								<strong>Recommended settings:</strong><br/>
								• <strong>Free tier users:</strong> 10 requests/minute, 2-3 second delays<br/>
								• <strong>Paid tier users:</strong> 50-100 requests/minute, 1 second delays<br/>
								• <strong>Cost limits:</strong> Start conservative and adjust based on your needs
							</InfoText>
						</InfoContainer>
					</>
				)}
			</Container>
		</Section>
	)
}

export default memo(RateLimitingSettings)