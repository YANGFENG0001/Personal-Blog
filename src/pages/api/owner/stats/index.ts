import type { APIRoute } from 'astro';
import { handle } from '../../../../server/http';
import { growthSummary, ownerStats } from '../../../../server/services/stats';
import { activityHeatmap, recordActivity } from '../../../../server/services/activity';

export const GET: APIRoute = handle(() => ({ stats: ownerStats(), growth: growthSummary(), heatmap: activityHeatmap() }));
/** Manual study check-in; feeds the learning streak. */
export const POST: APIRoute = handle(() => recordActivity('checkin'));
