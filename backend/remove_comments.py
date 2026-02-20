import sys
import libcst as cst

class RemoveComments(cst.CSTTransformer):
    def leave_EmptyLine(self, original_node, updated_node):
        # Remove linha se ela tem comentário isolado
        if original_node.comment:
            return cst.RemovalSentinel.REMOVE
        return updated_node

    def leave_TrailingWhitespace(self, original_node, updated_node):
        # Remove comentário inline
        if original_node.comment:
            return updated_node.with_changes(comment=None)
        return updated_node

def main():
    file_path = sys.argv[1]
    with open(file_path, "r", encoding="utf-8") as f:
        code = f.read()

    module = cst.parse_module(code)
    new_module = module.visit(RemoveComments())

    # Gravar sem alterar estilo
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_module.code)

if __name__ == "__main__":
    main()