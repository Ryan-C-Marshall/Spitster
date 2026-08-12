import type { CSSProperties } from 'react';

// Same palette used for the bingo spinner sections and the home page's
// spinning mode border, mapped onto the letters of the word itself.
const BINGO_LETTER_COLORS: Record<string, string> = {
  B: '#fefc92ff',
  I: '#f7b2f4ff',
  N: '#6abbdfff',
  G: '#7ccb7fff',
  O: '#b158f5ff',
};

/**
 * Renders the word "Bingo" (or "BINGO", any casing) with each letter tinted
 * to its matching palette color. Any character that isn't one of B/I/N/G/O
 * is left uncolored, so this is safe to use even if surrounding punctuation
 * or whitespace is passed in as part of `text`.
 */
export function BingoWordmark({ text = 'Bingo!', className }: { text?: string; className?: string }) {
  return (
    // bold text
    <span className={`${className}` } style={{ fontWeight: 'bold' }}>
      {text.split('').map((char, index) => {
        // mute each colour a bit from what we get from BINGO_LETTER_COLORS, so that the text is still readable on a white background
        const color = BINGO_LETTER_COLORS[char.toUpperCase()];
        return (
          <span key={index} style={color ? ({ color } as CSSProperties) : undefined}>
            {char}
          </span>
        );
      })}
    </span>
  );
}
