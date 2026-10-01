import type { ExportScope } from '../render/exportImage';

export type ExportFormat = 'png' | 'svg';

/** Open state and preset of the export dialog (one board is open at a time). */
class ExportDialogState {
	open = $state(false);
	format = $state<ExportFormat>('png');
	scope = $state<ExportScope['kind']>('board');

	show(format: ExportFormat, scope: ExportScope['kind'] = 'board'): void {
		this.format = format;
		this.scope = scope;
		this.open = true;
	}
}

export const exportDialog = new ExportDialogState();
