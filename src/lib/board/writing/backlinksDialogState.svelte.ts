/** The "Mentioned in" dialog for a selected object (from the context menu). */
class BacklinksDialogState {
	targetId = $state<string | null>(null);
}
export const backlinksDialog = new BacklinksDialogState();
