class MockGraph:
    def __init__(self):
        self.nodes = []
        self.edges = []
        self._node_ids = set()
        self._edge_id = 0
        
    def add_node(self, node_id, label, **kwargs):
        if node_id not in self._node_ids:
            self.nodes.append({"id": node_id, "label": label, **kwargs})
            self._node_ids.add(node_id)
            
    def add_edge(self, source, target, label, **kwargs):
        self._edge_id += 1
        edge = {"id": self._edge_id, "from": source, "to": target, "label": label}
        edge.update(kwargs)
        self.edges.append(edge)


def build_relationship_graph(relationships):
    graph = MockGraph()
    for rel in relationships:
        source = rel.get("source")
        target = rel.get("target")
        label = rel.get("relationship")
        
        if source and target:
            graph.add_node(source, source)
            graph.add_node(target, target)
            graph.add_edge(
                source, 
                target, 
                label,
                page=rel.get("page"),
                project_id=rel.get("project_id"),
                document_id=rel.get("document_id")
            )
            
    return graph
