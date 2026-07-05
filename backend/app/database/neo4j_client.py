import os
from neo4j import GraphDatabase
from typing import List, Dict, Any

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

class TelecomKnowledgeGraph:
    def __init__(self, uri, user, password):
        try:
            self.driver = GraphDatabase.driver(uri, auth=(user, password))
        except Exception as e:
            print(f"[WARNING] Failed to connect to Neo4j: {e}")
            self.driver = None

    def close(self):
        if self.driver:
            self.driver.close()

    def query(self, cypher_query: str, parameters: dict = None) -> List[Dict[str, Any]]:
        if not self.driver:
            print("[WARNING] Neo4j is not connected. Returning mock graph query.")
            return []
        
        try:
            with self.driver.session() as session:
                result = session.run(cypher_query, parameters)
                return [record.data() for record in result]
        except Exception as e:
            print(f"[ERROR] Cypher query failed: {e}")
            return []

    def check_outage_frequency(self, tower_id: str, days: int = 7) -> int:
        """Counts how many outages a tower has had in the last N days."""
        query = """
        MATCH (t:Tower {id: $tower_id})-[:HAS_OUTAGE]->(o:Incident)
        WHERE o.timestamp > datetime() - duration('P' + $days + 'D')
        RETURN count(o) as outage_count
        """
        result = self.query(query, parameters={"tower_id": tower_id, "days": str(days)})
        if result:
            return result[0].get("outage_count", 0)
        return 0 # Fallback

# Singleton instance
kg_client = TelecomKnowledgeGraph(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
