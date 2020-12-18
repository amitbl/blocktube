'use strict';

CodeMirror.defineSimpleMode("blocktube", {
  start: [
    { regex: /\/\/.*/, token: "comment", sol: true },
    {
      regex: /\/.+\/(.*)/,
      token: "keyword", sol: true
    },
  ],
  comment: [],
  meta: {
    dontIndentStates: ["comment"],
    lineComment: "//"
  }
});
