import { memo, useMemo } from "react"
import styled, { keyframes } from "styled-components"

interface CostMonitorProps {
	currentSessionCost: number
	currentDayCost: number
	maxSessionCost: number
	maxDayCost: number
	warningThreshold: number
	isRateLimited: boolean
	requestsInCurrentMinute: number
	maxRequestsPerMinute: number
	timeUntilNextRequest: number
}

const pulse = keyframes`
	0% { opacity: 0.6; }
	50% { opacity: 1; }
	100% { opacity: 0.6; }
`

const Container = styled.div<{ $isWarning: boolean; $isBlocked: boolean }>`
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 8px 12px;
	border-radius: 4px;
	font-size: 12px;
	background: ${props => 
		props.$isBlocked 
			? 'var(--vscode-inputValidation-errorBackground)'
			: props.$isWarning
			? 'var(--vscode-inputValidation-warningBackground)'
			: 'var(--vscode-badge-background)'
	};
	border: 1px solid ${props => 
		props.$isBlocked 
			? 'var(--vscode-inputValidation-errorBorder)'
			: props.$isWarning
			? 'var(--vscode-inputValidation-warningBorder)'
			: 'var(--vscode-badge-background)'
	};
	color: ${props => 
		props.$isBlocked 
			? 'var(--vscode-inputValidation-errorForeground)'
			: props.$isWarning
			? 'var(--vscode-inputValidation-warningForeground)'
			: 'var(--vscode-badge-foreground)'
	};
	animation: ${props => props.$isBlocked ? pulse : 'none'} 1.5s infinite;
`

const MetricGroup = styled.div`
	display: flex;
	flex-direction: column;
	gap: 2px;
`

const MetricLabel = styled.span`
	opacity: 0.8;
	font-size: 10px;
`

const MetricValue = styled.span<{ $isHigh?: boolean }>`
	font-weight: 500;
	color: ${props => props.$isHigh ? 'var(--vscode-errorForeground)' : 'inherit'};
`

const ProgressBar = styled.div<{ $percentage: number; $isWarning: boolean }>`
	width: 60px;
	height: 4px;
	background: var(--vscode-scrollbarSlider-background);
	border-radius: 2px;
	overflow: hidden;
	position: relative;

	&::after {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		width: ${props => Math.min(100, props.$percentage)}%;
		background: ${props => 
			props.$percentage > 90 
				? 'var(--vscode-errorForeground)'
				: props.$isWarning
				? 'var(--vscode-inputValidation-warningBorder)'
				: 'var(--vscode-progressBar-background)'
		};
		transition: width 0.3s ease;
	}
`

const Separator = styled.div`
	width: 1px;
	height: 20px;
	background: currentColor;
	opacity: 0.3;
`

const CountdownText = styled.span`
	font-family: monospace;
	font-weight: 500;
	color: var(--vscode-errorForeground);
`

const CostMonitor = ({
	currentSessionCost,
	currentDayCost,
	maxSessionCost,
	maxDayCost,
	warningThreshold,
	isRateLimited,
	requestsInCurrentMinute,
	maxRequestsPerMinute,
	timeUntilNextRequest
}: CostMonitorProps) => {
	const { sessionPercentage, dayPercentage, isWarning, isBlocked } = useMemo(() => {
		const sessionPercentage = (currentSessionCost / maxSessionCost) * 100
		const dayPercentage = (currentDayCost / maxDayCost) * 100
		const ratePercentage = (requestsInCurrentMinute / maxRequestsPerMinute) * 100
		
		const isWarning = sessionPercentage >= warningThreshold || 
						 dayPercentage >= warningThreshold ||
						 ratePercentage >= warningThreshold
		
		const isBlocked = isRateLimited || 
						 sessionPercentage >= 100 || 
						 dayPercentage >= 100 ||
						 ratePercentage >= 100

		return { sessionPercentage, dayPercentage, isWarning, isBlocked }
	}, [currentSessionCost, maxSessionCost, currentDayCost, maxDayCost, warningThreshold, isRateLimited, requestsInCurrentMinute, maxRequestsPerMinute])

	const formatCost = (cost: number) => `$${cost.toFixed(2)}`
	
	const formatCountdown = (ms: number) => {
		if (ms <= 0) return "0s"
		const seconds = Math.ceil(ms / 1000)
		return `${seconds}s`
	}

	return (
		<Container $isWarning={isWarning} $isBlocked={isBlocked}>
			<MetricGroup>
				<MetricLabel>Session</MetricLabel>
				<MetricValue $isHigh={sessionPercentage >= 90}>
					{formatCost(currentSessionCost)}
				</MetricValue>
				<ProgressBar $percentage={sessionPercentage} $isWarning={sessionPercentage >= warningThreshold} />
			</MetricGroup>

			<Separator />

			<MetricGroup>
				<MetricLabel>Daily</MetricLabel>
				<MetricValue $isHigh={dayPercentage >= 90}>
					{formatCost(currentDayCost)}
				</MetricValue>
				<ProgressBar $percentage={dayPercentage} $isWarning={dayPercentage >= warningThreshold} />
			</MetricGroup>

			<Separator />

			<MetricGroup>
				<MetricLabel>Rate</MetricLabel>
				<MetricValue $isHigh={requestsInCurrentMinute >= maxRequestsPerMinute * 0.9}>
					{requestsInCurrentMinute}/{maxRequestsPerMinute}
				</MetricValue>
				<ProgressBar 
					$percentage={(requestsInCurrentMinute / maxRequestsPerMinute) * 100} 
					$isWarning={(requestsInCurrentMinute / maxRequestsPerMinute) >= (warningThreshold / 100)} 
				/>
			</MetricGroup>

			{isBlocked && timeUntilNextRequest > 0 && (
				<>
					<Separator />
					<MetricGroup>
						<MetricLabel>Wait</MetricLabel>
						<CountdownText>{formatCountdown(timeUntilNextRequest)}</CountdownText>
					</MetricGroup>
				</>
			)}
		</Container>
	)
}

export default memo(CostMonitor)