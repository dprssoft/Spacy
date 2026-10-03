/** An entry of the media "More" menu; `checked` makes it a toggle. */
export interface MoreItem {
	label: string;
	keys?: string;
	checked?: boolean;
	disabled?: boolean;
	run: () => void;
}
