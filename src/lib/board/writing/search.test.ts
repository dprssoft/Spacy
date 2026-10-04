import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { context, docTexts, isRiskyRegex, makeMatcher, plainText, type Matcher } from './search';

const m = (
	q: string,
	o: Partial<{ matchCase: boolean; wholeWord: boolean; regex: boolean }> = {}
) => makeMatcher(q, { matchCase: false, wholeWord: false, regex: false, ...o }) as Matcher;

describe('makeMatcher', () => {
	it('plain, case-insensitive by default; special characters are literal', () => {
		expect(
			m('mara')
				.find('Mara met MARA and Marabou')
				.map((x) => x.text)
		).toEqual(['Mara', 'MARA', 'Mara']);
		expect(
			m('a.b')
				.find('a.b axb')
				.map((x) => x.from)
		).toEqual([0]);
	});

	it('match case and whole word (Unicode letters)', () => {
		expect(m('Mara', { matchCase: true }).find('Mara mara').length).toBe(1);
		expect(
			m('mara', { wholeWord: true })
				.find('Mara, Marabou, Émara')
				.map((x) => x.text)
		).toEqual(['Mara']);
	});

	it('regular expressions with groups in the replacement', () => {
		const re = m('(\\w+)@(\\w+)', { regex: true });
		expect(re.find('ann@x bob@y').map((x) => x.text)).toEqual(['ann@x', 'bob@y']);
		expect(re.replace('ann@x', '$2:$1')).toBe('x:ann');
		expect(m('a', { regex: false }).replace('a', '$1')).toBe('$1');
	});

	it('refuses invalid and catastrophic patterns', () => {
		expect(makeMatcher('(', { matchCase: false, wholeWord: false, regex: true })).toEqual({
			error: 'Not a valid regular expression'
		});
		expect(isRiskyRegex('(a+)+$')).toBe(true);
		expect(isRiskyRegex('(.*)*x')).toBe(true);
		expect(isRiskyRegex('(\\w+)@(\\w+)')).toBe(false);
		expect(makeMatcher('(a+)+$', { matchCase: false, wholeWord: false, regex: true })).toEqual({
			error: 'This pattern could be very slow'
		});
		expect(makeMatcher('', { matchCase: false, wholeWord: false, regex: false })).toBeNull();
	});
});

describe('doc texts', () => {
	it('walks text nodes in order, plain text without formatting', () => {
		const doc = new Y.Doc();
		const frag = doc.getXmlFragment('f');
		const p1 = new Y.XmlElement('paragraph');
		const p2 = new Y.XmlElement('paragraph');
		frag.insert(0, [p1, p2]);
		const t1 = new Y.XmlText();
		p1.insert(0, [t1]);
		t1.insert(0, 'Hello ');
		t1.insert(6, 'bold', { bold: true });
		const t2 = new Y.XmlText('Second');
		p2.insert(0, [t2]);
		expect(docTexts(frag).map(plainText)).toEqual(['Hello bold', 'Second']);
	});

	it('context around a match', () => {
		expect(context('x'.repeat(50) + 'Mara' + 'y'.repeat(50), 50, 54, 5)).toEqual({
			before: '…xxxxx',
			match: 'Mara',
			after: 'yyyyy…'
		});
	});
});
