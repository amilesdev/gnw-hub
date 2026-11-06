// Shared class strings, importable from server and client components alike
// (a constant exported from a 'use client' module reaches the server as a
// client reference, not the string).

/** Rows in one card with hairline dividers inset 16px (CMP-11 list-in-card). */
export const listCard =
  'card overflow-hidden [&>*+*]:relative [&>*+*]:before:absolute [&>*+*]:before:inset-x-4 [&>*+*]:before:top-0 [&>*+*]:before:h-px [&>*+*]:before:bg-line';
