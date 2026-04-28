import os
import shutil
from pathlib import Path

from dotenv import load_dotenv
from langchain_community.document_loaders import TextLoader
from langchain_community.vectorstores import FAISS
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.prompts import PromptTemplate
from operator import itemgetter


def RAG(user_input: str, runtime_dir: Path | None = None) -> str:
    # Keep Render compatibility while still supporting local .env workflows.
    load_dotenv()
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY is not set in environment variables.")

    # Resolve runtime paths (writable on Render).
    if runtime_dir is None:
        runtime_dir = Path(__file__).resolve().parent.parent / "runtime"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    vector_db_path = runtime_dir / "faiss_index"
    context_file = runtime_dir / "output.txt"

    # Optional OpenRouter ranking headers
    openrouter_headers: dict[str, str] = {}
    http_referer = os.getenv("OPENROUTER_HTTP_REFERER")
    title = os.getenv("OPENROUTER_TITLE")
    if http_referer:
        openrouter_headers["HTTP-Referer"] = http_referer
    if title:
        openrouter_headers["X-OpenRouter-Title"] = title

    # OpenRouter is OpenAI-compatible at this base URL.
    openrouter_base_url = "https://openrouter.ai/api/v1"
    chat_model = "openai/gpt-5.2"

    model = ChatOpenAI(
        model=chat_model,
        api_key=OPENROUTER_API_KEY,
        base_url=openrouter_base_url,
        default_headers=openrouter_headers or None,
        max_tokens=512,
    )
    parser = StrOutputParser()

    prompt_template = """Answer the question based on the context below. If you don't know the answer, 
    just say that you don't know — don't try to make up an answer.

    Context: {context}
    Question: {question}
    """
    prompt = PromptTemplate.from_template(prompt_template)

    if not context_file.exists():
        raise FileNotFoundError(
            "No processed context found. Please ingest a file or URL before asking a question."
        )

    embeddings = OpenAIEmbeddings(
        model="openai/text-embedding-3-small",
        api_key=OPENROUTER_API_KEY,
        base_url=openrouter_base_url,
        default_headers=openrouter_headers or None,
    )
    loader = TextLoader(str(context_file), encoding="utf-8")
    pages = loader.load_and_split()

    vector_db_path_str = str(vector_db_path)
    if vector_db_path.exists():
        try:
            print(f"Loading existing FAISS vector store: {vector_db_path_str}")
            vectorstore = FAISS.load_local(
                vector_db_path_str, embeddings, allow_dangerous_deserialization=True
            )

            existing_texts = {doc.page_content for doc in vectorstore.docstore._dict.values()}
            new_pages = [doc for doc in pages if doc.page_content not in existing_texts]

            if new_pages:
                print(f"Adding {len(new_pages)} new documents to vector store.")
                try:
                    vectorstore.add_documents(new_pages)
                    vectorstore.save_local(vector_db_path_str)
                except AssertionError:
                    print(
                        "FAISS index dimension mismatch detected. Rebuilding vector store with current embeddings..."
                    )
                    shutil.rmtree(vector_db_path_str, ignore_errors=True)
                    vectorstore = FAISS.from_documents(pages, embedding=embeddings)
                    vectorstore.save_local(vector_db_path_str)
            else:
                print("No new documents to add.")
        except Exception as e:
            print(f"Failed to load existing vector store ({e}). Rebuilding...")
            shutil.rmtree(vector_db_path_str, ignore_errors=True)
            vectorstore = FAISS.from_documents(pages, embedding=embeddings)
            vectorstore.save_local(vector_db_path_str)
    else:
        print("Creating new FAISS vector store...")
        vectorstore = FAISS.from_documents(pages, embedding=embeddings)
        vectorstore.save_local(vector_db_path_str)

    retriever = vectorstore.as_retriever()

    chain = {"context": itemgetter("question") | retriever, "question": itemgetter("question")} | prompt | model | parser
    return chain.invoke({"question": user_input})


if __name__ == "__main__":
    user_input = input("Enter your question: ")
    result = RAG(user_input)
    print(result)

