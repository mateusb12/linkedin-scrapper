function removeLineAndBlockComments(context, comments) {
  for (const comment of comments) {
    context.report({
      node: comment,
      messageId: 'noComment',
      fix: (fixer) => fixer.removeRange(comment.range),
    });
  }
}

function shouldRemoveJsxCommentContainer(node) {
  return (
    node.expression &&
    node.expression.type === 'JSXEmptyExpression' &&
    Array.isArray(node.expression.comments) &&
    node.expression.comments.length > 0
  );
}

function removeJsxCommentContainer(context, node) {
  context.report({
    node,
    messageId: 'noComment',
    fix: (fixer) => fixer.remove(node),
  });
}

function createRemoveCommentsRule(context) {
  const source = context.getSourceCode();
  const comments = source.getAllComments();
  removeLineAndBlockComments(context, comments);

  return {
    JSXExpressionContainer(node) {
      if (shouldRemoveJsxCommentContainer(node)) {
        removeJsxCommentContainer(context, node);
      }
    },
  };
}

function createRemoveEmptyBlocksRule(context) {
  return {
    BlockStatement(node) {
      if (node.body.length === 0) {
        context.report({
          node,
          message: 'Empty block is not allowed',
          fix: (fixer) => fixer.removeRange(node.range),
        });
      }
    },
  };
}

export default {
  rules: {
    'no-explanatory-comments': {
      meta: {
        type: 'suggestion',
        fixable: 'code',
        docs: { description: 'Remove all comments' },
        messages: { noComment: 'CMT001 Do not commit comments' },
      },
      create: createRemoveCommentsRule,
    },

    'no-empty-blocks': {
      meta: {
        type: 'suggestion',
        fixable: 'code',
        messages: { default: 'Empty block is not allowed' },
      },
      create: createRemoveEmptyBlocksRule,
    },
  },
};
