import type { StageInfo } from './engine';
export function stageText(i: StageInfo): { short: string; tone: string; long: string } {
  switch (i.stage) {
    case 'RELEASED': return { short: 'Released ✓', tone: 'green', long: 'Released successfully' };
    case 'PROCESSING': return { short: 'Processing', tone: 'orange', long: 'Payment processing' };
    case 'WAITING_DATE': return { short: 'Waiting', tone: 'blue', long: 'Everyone has paid. Waiting for the payout date' };
    case 'WAITING_PAYMENTS': return { short: `Waiting ${i.paid}/${i.total}`, tone: 'orange', long: `Waiting for other members' payment (${i.paid} of ${i.total} paid)` };
    default: return { short: 'Scheduled', tone: 'blue', long: 'Scheduled' };
  }
}
