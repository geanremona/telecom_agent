import os
import chromadb
from chromadb.utils import embedding_functions

CHROMA_DB_PATH = os.path.join(os.path.dirname(__file__), "chroma_data")

class TelecomRAGStore:
    def __init__(self):
        # We use a lightweight local embedding model
        self.embedding_func = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        # Use PersistentClient so embeddings are saved to disk
        self.client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
        
        # Get or create the collection for outage logs
        self.collection = self.client.get_or_create_collection(
            name="outage_reports",
            embedding_function=self.embedding_func
        )

        # Seed the DB with some mock historical data if it's empty
        if self.collection.count() == 0:
            self._seed_data()

    def _seed_data(self):
        print("[INFO] Seeding ChromaDB with historical outage data...")
        documents = [
            "TOWER-42: Battery voltage drop to 12V. Rectifier alarm active. Cause: Faulty rectifier. Action: Replaced PSU.",
            "TOWER-18: Signal fluctuation on sector 2/3. Packet loss 18%. Cause: Antenna misalignment. Action: Realigned antenna.",
            "TOWER-CORE: Unauthorized SSH connection attempt. Cause: Zero-Day APT. Action: Isolated VLAN.",
            "TOWER-99: Fiber backhaul cut. Complete loss of connectivity. Cause: Excavation damage. Action: Dispatched splice crew."
        ]
        metadatas = [
            {"tower_id": "TOWER-42", "cause": "Faulty rectifier"},
            {"tower_id": "TOWER-18", "cause": "Antenna misalignment"},
            {"tower_id": "TOWER-CORE", "cause": "Zero-Day APT"},
            {"tower_id": "TOWER-99", "cause": "Physical fiber damage"}
        ]
        ids = [f"hist_outage_{i}" for i in range(len(documents))]
        
        self.collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )

    def retrieve_context(self, query: str, n_results: int = 2) -> str:
        """Retrieves similar past outages to augment the LLM prompt."""
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results
            )
            
            if not results["documents"] or not results["documents"][0]:
                return "No historical context found."
            
            context_str = "HISTORICAL CONTEXT:\n"
            for i, doc in enumerate(results["documents"][0]):
                meta = results["metadatas"][0][i]
                context_str += f"- Past Incident: {doc} (Verified Cause: {meta.get('cause')})\n"
            return context_str
        except Exception as e:
            print(f"[ERROR] ChromaDB Retrieval Failed: {e}")
            return "RAG Retrieval unavailable."

# Singleton
rag_store = TelecomRAGStore()
