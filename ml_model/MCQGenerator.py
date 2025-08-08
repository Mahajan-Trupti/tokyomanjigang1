import os
import PyPDF2
import re
import json
import time
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lex_rank import LexRankSummarizer

os.environ["GOOGLE_API_KEY"] = "AIzaSyB7r16A-knFSxZ9TnRc9BcNefzLl-gYVT0"

def extract_pdf_text_from_file(pdf_path):
    text = ""
    try:
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                else:
                    print(f"Warning: Page {page_num + 1} has no extractable text.")
    except FileNotFoundError:
        print(f"Error: The file at {pdf_path} was not found.")
        return None
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return None
    return text

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash-latest", temperature=0.3)
MAX_CONTEXT_LENGTH = 100000

topic_prompt = PromptTemplate.from_template("""
You are an intelligent document analyzer.
Your task is to read the provided text and identify the main topics covered.
Provide exactly 9 topics. The topics should be concise and relevant to the content.
Return the topics as a JSON array of strings, for example: ["Topic 1", "Topic 2", "Topic 3"].

=== INPUT START ===
{text}
=== INPUT END ===
""")

topic_chain = topic_prompt | llm | StrOutputParser()

mcq_prompt_multiple = """
You are an intelligent and structured MCQ (Multiple Choice Question) generator.

Your task is to read the given educational content and create exactly {num_questions} multiple-choice questions (MCQs) that meet the following guidelines. The questions should have a difficulty level of {difficulty}.

{topics_instruction}

1. Format:
Question: <your question>
Options:
A. <option A>
B. <option B>
C. <option C>
D. <option D>
Answer: <Correct Option Letter>
Explanation: <Short explanation of the correct answer>
Difficulty: <Easy / Medium / Hard>
Topic: <Main concept or subject>

Repeat this format for each of the {num_questions} questions.

2. Guidelines:
- Use only information from the provided content.
- Avoid vague or trivial questions.
- Distractors must be plausible but incorrect.
- The output should be plain text. Do not use any markdown formatting.

=== INPUT START ===
{text}
=== INPUT END ===
"""

prompt = PromptTemplate.from_template(mcq_prompt_multiple)
chain = prompt | llm | StrOutputParser()

def parse_mcq_output(text_output):
    mcq_parts = text_output.split('Question:')
    mcq_list = [('Question:' + part).strip() for part in mcq_parts if part.strip()]
    return mcq_list

def generate_summary_from_file(pdf_path, sentences_count=5):
    pdf_text = extract_pdf_text_from_file(pdf_path)
    if not pdf_text:
        return None
    
    try:
        parser = PlaintextParser.from_string(pdf_text, Tokenizer("english"))
        summarizer_obj = LexRankSummarizer()
        summary_sentences = summarizer_obj(parser.document, sentences_count=sentences_count)
        summary = " ".join([str(sentence) for sentence in summary_sentences])
        return summary
    except Exception as e:
        print(f"Error generating summary: {e}")
        return None

def generate_keywords_from_file(pdf_path):
    pdf_text = extract_pdf_text_from_file(pdf_path)
    if not pdf_text:
        return []
    
    try:
        generated_keywords = keywords(pdf_text, ratio=0.1, words=10).split('\n')
        return generated_keywords
    except Exception as e:
        print(f"Error generating keywords: {e}")
        return []

def generate_topics_from_file(pdf_path):
    pdf_text = extract_pdf_text_from_file(pdf_path)
    if not pdf_text:
        print("Debugging: No PDF text extracted.")
        return []
    
    trimmed_text = pdf_text[:MAX_CONTEXT_LENGTH]
    
    try:
        print("Debugging: Invoking topic chain with text...")
        result = topic_chain.invoke({"text": trimmed_text})
        print("Debugging: LLM raw result:", result)
        
        # New robust JSON parsing logic
        match = re.search(r'\[.*?\]', result, re.DOTALL)
        if match:
            json_string = match.group(0)
            topics = json.loads(json_string)
            print("Debugging: Parsed topics:", topics)
            return topics
        else:
            print("Debugging: No JSON array found in LLM response.")
            return []
            
    except json.JSONDecodeError as e:
        print(f"Debugging: JSON decoding error - LLM returned non-JSON format: {e}")
        return []
    except Exception as e:
        print(f"Debugging: Error generating topics: {e}")
        return []

def generate_mcqs_from_file(pdf_path, difficulty, num_questions, topics, max_retries=5, initial_delay=1):
    pdf_text = extract_pdf_text_from_file(pdf_path)
    if not pdf_text:
        return ["No text extracted from the PDF or file not found."]
    
    trimmed_text = pdf_text[:MAX_CONTEXT_LENGTH]

    topics_instruction = ""
    if topics:
        topics_instruction = f"The questions should be focused on the following topics: {', '.join(topics)}."

    retries = 0
    while retries < max_retries:
        try:
            result = chain.invoke({
                "text": trimmed_text, 
                "difficulty": difficulty.capitalize(), 
                "num_questions": num_questions,
                "topics_instruction": topics_instruction
            })
            
            parsed_mcqs = parse_mcq_output(result)
            
            return parsed_mcqs
        except Exception as e:
            print(f"Error generating MCQs: {e}")
            if "quota" in str(e).lower() or "rate limit" in str(e).lower():
                delay = initial_delay * (2 ** retries)
                print(f"Rate limit hit. Retrying in {delay} seconds (Retry {retries + 1}/{max_retries})...")
                time.sleep(delay)
                retries += 1
            else:
                return [f"Error generating MCQs: {e}"]
    
    return [f"Failed to generate MCQs after {max_retries} retries due to API limits."]