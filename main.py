import os
from dotenv import load_dotenv
import pickle
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_core.output_parsers import StrOutputParser
from langchain_community.document_loaders import TextLoader
from langchain.prompts import PromptTemplate
from langchain_community.vectorstores import FAISS
from langchain.docstore.document import Document
from operator import itemgetter

VECTOR_DB_PATH = "faiss_index"

def RAG(user_input):
    load_dotenv()
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    MODEL1 = "gemini-2.0-flash"

    model = ChatGoogleGenerativeAI(model=MODEL1, google_api_key=GOOGLE_API_KEY)
    parser = StrOutputParser()

    prompt_template = """Answer the question based on the context below. If you don't know the answer, 
    just say that you don't know — don't try to make up an answer.

    Context: {context}
    Question: {question}
    """
    prompt = PromptTemplate.from_template(prompt_template)

    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")

    if os.path.exists(VECTOR_DB_PATH):
        print("Loading cached FAISS vector store...")
        vectorstore = FAISS.load_local(VECTOR_DB_PATH, embeddings, allow_dangerous_deserialization=True)
    else:
        print("Computing embeddings and saving to FAISS...")
        loader = TextLoader("output.txt", encoding="utf-8")
        pages = loader.load_and_split()

        vectorstore = FAISS.from_documents(pages, embedding=embeddings)
        vectorstore.save_local(VECTOR_DB_PATH)

    retriever = vectorstore.as_retriever()

    chain = {
        "context": itemgetter("question") | retriever,
        "question": itemgetter("question")
    } | prompt | model | parser

    result = chain.invoke({"question": user_input})
    return result

if __name__ == "__main__":
    user_input = input("Enter your question: ")
    result = RAG(user_input)
    print(result)

