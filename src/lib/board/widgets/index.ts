// Registers every widget kind (pure: imported by the views, exports and tests alike).
import './timer/timer';
import './wheel/wheel';
import './randomizer/randomizer';
import './dice/dice';

export { allWidgetKinds, readWidget, widgetKind, widgetView, WIDGET_GROUPS } from './kinds';
export type { WidgetGroup, WidgetKind } from './kinds';
