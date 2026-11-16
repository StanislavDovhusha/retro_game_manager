import '../helpers/env.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesGame, searchGames, searchKey } from '../../shared/search.ts';

const game = (title: string, extra: { short?: string; fileName?: string; tags?: string[] } = {}) => ({
  title,
  short: extra.short ?? null,
  fileName: extra.fileName ?? `${title}.zip`,
  tags: extra.tags ?? [],
});

test('search: case-insensitive, in the title, the short title, the file name and the tags', () => {
  const zelda = game('The Legend of Zelda', { short: 'zeldaLttp', fileName: 'loz.sfc', tags: ['RPG', 'classic'] });
  for (const query of ['LEGEND', 'lttp', 'LOZ.SFC', 'rpg', 'Class']) assert.ok(matchesGame(zelda, searchKey(query)), query);
  assert.ok(!matchesGame(zelda, searchKey('mario')));
  assert.ok(matchesGame(zelda, searchKey('   ')), 'an empty query matches everything');
  assert.deepEqual(searchGames([zelda], '  '), [], 'but finds nothing');
});

test('search: the most relevant first, equal ones keep their order', () => {
  const games = [
    game('Tagged', { tags: ['mario'] }),
    game('Dr. Mario'),
    game('Supermario'),
    game('Mario Kart'),
    game('Short', { short: 'marioShort' }),
    game('Mario Bros.'),
    game('Unrelated'),
  ];
  assert.deepEqual(
    searchGames(games, 'mario').map((hit) => hit.title),
    ['Mario Kart', 'Mario Bros.', 'Dr. Mario', 'Supermario', 'Short', 'Tagged'],
  );
});
