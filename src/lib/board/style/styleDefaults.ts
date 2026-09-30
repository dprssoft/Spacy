import { baseStyleFor } from '$lib/model/defaults';
import type { ElementType, Style } from '$lib/model/types';

/** Style for new elements of `type`. Step 18 layers the user's saved defaults on top. */
export function getDefaultStyle(type: ElementType): Style {
	return baseStyleFor(type);
}
