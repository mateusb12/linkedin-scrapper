// 1. Alteramos para focar apenas no range do comentário
function removeLineAndBlockComments(context, comments) {
  for (const comment of comments) {
    context.report({
      loc: comment.loc, // É mais seguro usar 'loc' ao invés de 'node' para comentários soltos
      messageId: 'noComment',
      fix: (fixer) => fixer.removeRange(comment.range),
    });
  }
}

// 2. Simplificamos a validação: Se é vazio, removemos sem perguntar
function shouldRemoveJsxCommentContainer(node) {
  return (
      node.expression &&
      node.expression.type === 'JSXEmptyExpression'
  );
}

// 3. Atualizamos a remoção para usar removeRange (melhor prática no AST)
function removeJsxCommentContainer(context, node) {
  context.report({
    node,
    messageId: 'noComment',
    fix: (fixer) => fixer.removeRange(node.range),
  });
}

function createRemoveCommentsRule(context) {
  // 4. Suporte atualizado para ESLint v9 (getSourceCode foi depreciado)
  const source = context.sourceCode || context.getSourceCode();
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