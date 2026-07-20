from collections import defaultdict, deque

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# Allow the React dev server to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000', 'http://127.0.0.1:3000'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class Node(BaseModel):
    id: str

    class Config:
        extra = 'allow'


class Edge(BaseModel):
    source: str
    target: str

    class Config:
        extra = 'allow'


class Pipeline(BaseModel):
    nodes: list[Node]
    edges: list[Edge]


def is_dag(nodes: list[Node], edges: list[Edge]) -> bool:
    """Kahn's algorithm: the graph is a DAG iff a full topological order exists."""
    node_ids = {node.id for node in nodes}
    adjacency = defaultdict(list)
    in_degree = {node_id: 0 for node_id in node_ids}

    for edge in edges:
        if edge.source not in node_ids or edge.target not in node_ids:
            continue
        adjacency[edge.source].append(edge.target)
        in_degree[edge.target] += 1

    queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
    visited = 0

    while queue:
        current = queue.popleft()
        visited += 1
        for neighbor in adjacency[current]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return visited == len(node_ids)


@app.get('/')
def read_root():
    return {'Ping': 'Pong'}


@app.post('/pipelines/parse')
def parse_pipeline(pipeline: Pipeline):
    return {
        'num_nodes': len(pipeline.nodes),
        'num_edges': len(pipeline.edges),
        'is_dag': is_dag(pipeline.nodes, pipeline.edges),
    }
