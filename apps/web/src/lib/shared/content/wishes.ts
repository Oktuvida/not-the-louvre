/** A slip is a strip of paper: what fits on it is one line of handwriting. */
export const WISH_MAX_LENGTH = 80;

/** How many slips the mailbox hands out at a time. */
export const WISHES_IN_HAND = 3;

/** Something an artist would love to see drawn, left in the mailbox for others. */
export type Wish = {
	author: string;
	id: string;
	text: string;
};
