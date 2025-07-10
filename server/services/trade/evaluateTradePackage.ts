// Legacy compatibility - now uses enhanced trade logic
export { evaluateTradePackage } from './tradeLogic';
export type { 
  TradeInput as TradePackage, 
  TradePlayer as Player, 
  TradeEvaluationResult as TradeVerdict,
  TradeAnalysis
} from './tradeLogic';