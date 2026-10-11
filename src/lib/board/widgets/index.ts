// Registers every widget kind (pure: imported by the views, exports and tests alike).
import './timer/timer';

export { allWidgetKinds, readWidget, widgetKind, widgetView, WIDGET_GROUPS } from './kinds';
export type { WidgetGroup, WidgetKind } from './kinds';
