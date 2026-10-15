from functools import lru_cache

from sentence_transformers import SentenceTransformer


class EmbeddingModelUnavailableError(RuntimeError):
    """Raised when the locally cached embedding model is unavailable."""


class EmbeddingModel:
    def __init__(self):
        print("Loading embedding model...")

        try:
            self.model = SentenceTransformer(
                "sentence-transformers/all-MiniLM-L6-v2",
                device="cpu",
                local_files_only=True,
            )
        except Exception as error:
            raise EmbeddingModelUnavailableError(
                "The local sentence-transformers/all-MiniLM-L6-v2 embedding model is not available. "
                "Install or cache it before querying documents."
            ) from error

        print("Embedding model loaded.")

    def encode(self, texts):
        """
        Convert text into numerical embeddings.
        """
        return self.model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True
        )


@lru_cache(maxsize=1)
def get_embedding_model():
    """Load and reuse the local embedding model for this backend process."""
    return EmbeddingModel()


