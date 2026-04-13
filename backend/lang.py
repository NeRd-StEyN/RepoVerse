from typing import List, Dict, Any, TypedDict
from langgraph.graph import StateGraph, START, END
from langchain_groq import ChatGroq
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping
from wordcloud import WordCloud
import matplotlib.pyplot as plt
import os, re
import requests
from datetime import datetime
import numpy as np
from random import choice
from langchain_community.utilities import WikipediaAPIWrapper
from langchain_community.tools import DuckDuckGoSearchRun
from io import BytesIO
import base64
from dotenv import load_dotenv
from deep_translator import GoogleTranslator

load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")
wiki_wrapper = WikipediaAPIWrapper()
search = DuckDuckGoSearchRun()


LANGUAGE_CODES = {
    "English": "en",
    "Hindi": "hi",
    "Tamil": "ta",
    "Telugu": "te",
    "Bengali": "bn",
    "Marathi": "mr",
    "Spanish": "es",
    "French": "fr",
    "German": "de",
    "Italian": "it"
}



def translate_long_text(text: str, target_language: str, max_chunk: int = 4500) -> str:
    """Translate text in chunks to avoid API limits. Returns original if translation fails."""
    if target_language == "English" or not text:
        return text
    
    try:
        lang_code = LANGUAGE_CODES.get(target_language, "en")
        if lang_code == "en":
            return text
        
        translator = GoogleTranslator(source='en', target=lang_code)
        
 
        if len(text) <= max_chunk:
            return translator.translate(text)
        

        paragraphs = text.split('\n')
        translated = []
        current_batch = ""
        
        for para in paragraphs:
            if len(current_batch) + len(para) + 1 <= max_chunk:
                current_batch += para + "\n"
            else:
                if current_batch.strip():
                    translated.append(translator.translate(current_batch.strip()))
                current_batch = para + "\n"
        
        if current_batch.strip():
            translated.append(translator.translate(current_batch.strip()))
        
        return "\n".join(translated)
    except Exception as e:
        print(f"PDF translation error: {e}")
        return text

LANGUAGE_FONT_FAMILY = {
    "Hindi": "NotoSansDevanagari",
    "Marathi": "NotoSansDevanagari",
    "Tamil": "NotoSansTamil",
    "Telugu": "NotoSansTelugu",
    "Bengali": "NotoSansBengali",
    "English": "NotoSans",
    "Spanish": "NotoSans",
    "French": "NotoSans",
    "German": "NotoSans",
    "Italian": "NotoSans",
}



NOTO_URLS = {
    "NotoSans": {
        "regular": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
        "bold": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf",
    },
    "NotoSansDevanagari": {
        "regular": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf",
        "bold": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Bold.ttf",
    },
    "NotoSansTamil": {
        "regular": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansTamil/NotoSansTamil-Regular.ttf",
        "bold": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansTamil/NotoSansTamil-Bold.ttf",
    },
    "NotoSansTelugu": {
        "regular": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansTelugu/NotoSansTelugu-Regular.ttf",
        "bold": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansTelugu/NotoSansTelugu-Bold.ttf",
    },
    "NotoSansBengali": {
        "regular": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf",
        "bold": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansBengali/NotoSansBengali-Bold.ttf",
    },
    "NotoSansGujarati": {
        "regular": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansGujarati/NotoSansGujarati-Regular.ttf",
        "bold": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansGujarati/NotoSansGujarati-Bold.ttf",
    },
    "NotoSansKannada": {
        "regular": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansKannada/NotoSansKannada-Regular.ttf",
        "bold": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansKannada/NotoSansKannada-Bold.ttf",
    },
    "NotoSansMalayalam": {
        "regular": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansMalayalam/NotoSansMalayalam-Regular.ttf",
        "bold": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansMalayalam/NotoSansMalayalam-Bold.ttf",
    },
    "NotoSansGurmukhi": {
        "regular": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansGurmukhi/NotoSansGurmukhi-Regular.ttf",
        "bold": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansGurmukhi/NotoSansGurmukhi-Bold.ttf",
    },
    "NotoSansArabic": {
        "regular": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf",
        "bold": "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansArabic/NotoSansArabic-Bold.ttf",
    },

    "NotoSansJP": {
        "regular": "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansJP-Regular.otf",
        "bold": "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansJP-Bold.otf",
    },
    "NotoSansKR": {
        "regular": "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansKR-Regular.otf",
        "bold": "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansKR-Bold.otf",
    },
    "NotoSansSC": {
        "regular": "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/SimplifiedChinese/NotoSansSC-Regular.otf",
        "bold": "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/SimplifiedChinese/NotoSansSC-Bold.otf",
    },
}

FONTS_DIR = os.path.join(os.path.dirname(__file__), "fonts")

def _download_font(url: str, dest_path: str) -> None:
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    try:
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        with open(dest_path, "wb") as f:
            f.write(resp.content)
    except Exception as e:
        print(f"⚠️ Could not download font from {url}: {e}")

def _ensure_register_font_family(family: str) -> str:
    """Ensure the Noto font family (Regular/Bold) is downloaded and registered. Returns the base family name to use."""
    urls = NOTO_URLS.get(family)
    if not urls:
        return family

    reg_file = os.path.join(FONTS_DIR, f"{family}-Regular.ttf")
    bold_file = os.path.join(FONTS_DIR, f"{family}-Bold.ttf")

    if family in ("NotoSansJP", "NotoSansKR", "NotoSansSC"):
        reg_file = os.path.join(FONTS_DIR, f"{family}-Regular.otf")
        bold_file = os.path.join(FONTS_DIR, f"{family}-Bold.otf")

    if not os.path.exists(reg_file):
        _download_font(urls["regular"], reg_file)
    if not os.path.exists(bold_file):
        _download_font(urls["bold"], bold_file)

    try:
        if os.path.exists(reg_file):
            pdfmetrics.registerFont(TTFont(family, reg_file))
        if os.path.exists(bold_file):
            pdfmetrics.registerFont(TTFont(f"{family}-Bold", bold_file))
        try:
            addMapping(family, 0, 0, family)
            if os.path.exists(bold_file):
                addMapping(family, 1, 0, f"{family}-Bold")
        except Exception as e:
            print(f"⚠️ addMapping failed for {family}: {e}")
    except Exception as e:
        print(f"⚠️ Font registration failed for {family}: {e}")
    return family

def get_font_for_language(language: str) -> str:
    """Return a registered font family name suitable for the language; fallback smartly."""
    family = LANGUAGE_FONT_FAMILY.get(language or "English", "NotoSans")
    registered_family = _ensure_register_font_family(family)
    return registered_family or "Helvetica"

def translate_text(text: str, target_language: str) -> str:
    """Translate text to target language using Google Translate."""
    if target_language == "English" or not text:
        return text
    
    try:
        lang_code = LANGUAGE_CODES.get(target_language, "en")
        if lang_code == "en":
            return text
        
        max_chunk_size = 4500
        if len(text) <= max_chunk_size:
            translator = GoogleTranslator(source='en', target=lang_code)
            return translator.translate(text)
        else:
            paragraphs = text.split('\n')
            translated_paragraphs = []
            for para in paragraphs:
                if para.strip():
                    translator = GoogleTranslator(source='en', target=lang_code)
                    translated_paragraphs.append(translator.translate(para))
                else:
                    translated_paragraphs.append('')
            return '\n'.join(translated_paragraphs)
    except Exception as e:
        print(f"Translation error for {target_language}: {e}")
        return text

class GraphState(TypedDict):
    topic: str
    heading: str
    intro: str
    subtopics: List[str]
    content: Dict[str, str]
    summaries: Dict[str, str]
    insights: Dict[str, str]
    conclusion: str
 
    pdf_path: str
    pdf_base64: str
    language: str
    pages: int
    

groq_llm = ChatGroq(
    api_key=groq_api_key,
    temperature=0.7,
    model_name="llama-3.1-8b-instant"
)

def intro_agent(state: GraphState) -> Dict[str, Any]:
    """Generate a longer introduction about the main topic."""
    language = state.get("language", "English")
    
    prompt1 = f"Give a 2-3 word heading title for the topic '{state['topic']}' in English. If the topic is already of 1-4 words just give same title. Return ONLY the title."
    response_heading = groq_llm.invoke(prompt1)     
    heading = getattr(response_heading, "content", str(response_heading)).strip()
    
    prompt = f"Write a comprehensive introduction (about 200-250 words) about the topic '{heading}' in English. Include background context, significance, and what will be covered."
    response = groq_llm.invoke(prompt)
    intro_text = getattr(response, "content", str(response))
    
    return {"intro": intro_text}

def planner_agent(state: GraphState) -> Dict[str, Any]:
    topic = state["topic"]
    pages = state.get("pages", 3)
    language = state.get("language", "English")
    
    num_subtopics = 1 + (2 * (pages - 2))
    
    print(f"📊 Pages: {pages}")

    prompt1 = f"Give a 2-3 word heading title for the topic '{topic}' in English. Return ONLY the title."
  
    response_heading = groq_llm.invoke(prompt1)
    
    heading = getattr(response_heading, "content", str(response_heading)).strip()
    prompt = f"Break the topic '{heading}' into exactly {pages} major subtopics in English. Return only bullet points."
    
    response = groq_llm.invoke(prompt)
    text = getattr(response, "content", str(response))
    subtopics = [re.sub(r'^[-•*\d.\s]+', '', l).strip() for l in text.split("\n") if l.strip()]
    
    subtopics = subtopics[:num_subtopics] or [f"Overview of {topic}", "Key Aspects", "Future Outlook"]
    
    return {
        "heading": heading,
        "subtopics": subtopics
    }

def retriever_agent(state: GraphState) -> Dict[str, Any]:
    content = {}
    language = state.get("language", "English")
    
    for sub in state["subtopics"]:
        try:
            search_query = f"{sub} {state['topic']} latest 2025"
            search_results = search.run(search_query)
            
            prompt = f"Based on this current information from the web: {search_results[:2000]}\n\nWrite a detailed, up-to-date informative paragraph about '{sub}' in the context of '{state['topic']}' in English. Include recent developments and current statistics where relevant."
        except Exception as e:
            print(f"Web search failed for '{sub}': {e}, trying Wikipedia...")
            try:
                wiki_content = wiki_wrapper.run(f"{sub} {state['topic']}")
                prompt = f"Based on this information: {wiki_content[:1500]}\n\nWrite a detailed informative paragraph about '{sub}' in the context of '{state['topic']}' in English."
            except:
                prompt = f"Write a detailed, up-to-date informative paragraph about '{sub}' in the context of '{state['topic']}' in English. Focus on recent developments and current trends as of 2024-2025."
        
        response = groq_llm.invoke(prompt)
        content_text = getattr(response, "content", f"Content for {sub}")
        content[sub] = content_text
    return {"content": content}

def summarizer_agent(state: GraphState) -> Dict[str, Any]:
    summaries = {}
    language = state.get("language", "English")
    
    for sub, text in state["content"].items():
        prompt = f"Summarize this content about '{sub}' into a single coherent paragraph (no bullet points) in English: {text[:1500]}"
        response = groq_llm.invoke(prompt)
        summary = getattr(response, "content", str(response))
        summaries[sub] = summary
    return {"summaries": summaries}

def analyzer_agent(state: GraphState) -> Dict[str, Any]:
    insights = {}
    language = state.get("language", "English")
    
    for sub, summary in state["summaries"].items():
        prompt = f"List 3 key insights or takeaways from this text in English:\n{summary}"
        response = groq_llm.invoke(prompt)
        text = getattr(response, "content", str(response))

        cleaned_lines = []
        for l in text.split("\n"):
            l = re.sub(r'(?i)here are.*insights.*', '', l)
            if l.strip():
                line_clean = re.sub(r'^[-•*\d.\s]+', '', l).strip()
                cleaned_lines.append(f"- {line_clean}")
        insights[sub] = "\n".join(cleaned_lines).strip()
    return {"insights": insights}

def clean_text(text: str) -> str:
    """Remove markdown and unwanted characters while keeping word spacing."""
    text = re.sub(r'[*_`#>\-]+', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def clean_markdown(text: str) -> str:
    """Basic markdown cleaner for conclusion."""
    return clean_text(text)

def create_pdf_for_state(state: dict, target_lang: str) -> str:
    """Helper to generate PDF Base64 for a specific language."""
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    styleN = styles["Normal"]
    title_style = styles["Title"]

    unicode_font = get_font_for_language(target_lang)
    try:
        pdfmetrics.getFont(unicode_font)
    except Exception:
        try:
            import matplotlib.font_manager as fm
            dejavu_path = None
            for font in fm.findSystemFonts(fontpaths=None, fontext='ttf'):
                if 'DejaVuSans.ttf' in font:
                    dejavu_path = font
                    break
            if dejavu_path:
                pdfmetrics.registerFont(TTFont('DejaVuSans', dejavu_path))
                unicode_font = 'DejaVuSans'
            else:
                unicode_font = 'Helvetica'
        except Exception:
            unicode_font = 'Helvetica'

    title_bold_style = ParagraphStyle(
        "TitleBold", parent=title_style, fontName=unicode_font, fontSize=16
    )
    q_style = ParagraphStyle(
        "Subtopic", parent=styles["Heading2"], fontName=unicode_font, fontSize=13, leading=15, spaceAfter=5
    )
    a_style = ParagraphStyle(
        "Content", parent=styleN, fontName=unicode_font, fontSize=10, leading=13, spaceAfter=7
    )

    content = []

    title_clean = re.sub(r'["""*:-]+', "", state.get("heading", "")).strip()
    translated_title = translate_long_text(title_clean, target_lang)
    final_title = translated_title if translated_title and translated_title.strip() else title_clean
    content.append(Paragraph(f"<b>{final_title}</b>", title_bold_style))
    content.append(Spacer(1, 12))

    intro_text = clean_text(state.get("intro", ""))
    intro_text = translate_long_text(intro_text, target_lang)
    intro_label = translate_long_text("Introduction:", target_lang)
    content.append(Paragraph(f"<b>{intro_label}</b>", q_style))
    content.append(Paragraph(intro_text, a_style))
    content.append(Spacer(1, 10))

    for i, sub in enumerate(state.get("summaries", {}), 1):

        sub_clean = re.sub(r'["""*•\-]+', "", sub).strip()
        sub_translated = translate_long_text(sub_clean, target_lang)

        if sub_translated:
            heading_text = f"<b>{i}. {sub_translated}:</b>"
            content.append(Paragraph(heading_text, q_style))

        summary_text = clean_text(state["summaries"][sub])
        summary_text = translate_long_text(summary_text, target_lang)
        content.append(Paragraph(summary_text, a_style))

        if sub in state.get("insights", {}):
            insights_text = state["insights"][sub]
            cleaned_lines = []
            for line in insights_text.split("\n"):
                line = re.sub(r"(?i)here\s+are.*insights.*", "", line).strip()
                line = clean_text(line)
                if line:
                    cleaned_lines.append(line)

            if cleaned_lines:
                insights_label = translate_long_text("Insights:", target_lang)
                content.append(Paragraph(f"<b>{insights_label}</b>", a_style))
                for line in cleaned_lines:
                    translated_line = translate_long_text(line, target_lang)
                    content.append(Paragraph(translated_line, a_style))

        content.append(Spacer(1, 4))

    conclusion_label = translate_long_text("Conclusion:", target_lang)
    content.append(Paragraph(f"<b>{conclusion_label}</b>", q_style))

    conclusion_text = clean_markdown(state.get("conclusion", "Conclusion not available."))
    conclusion_text = translate_long_text(conclusion_text, target_lang)
    content.append(Paragraph(conclusion_text, a_style))
    content.append(Spacer(1, 20))

    if "visualizations" in state and state["visualizations"]:
        visual_label = translate_long_text("Visual Summary:", target_lang)
        content.append(Paragraph(f"<b>{visual_label}</b>", q_style))
        for img_path in state["visualizations"]:
            content.append(Spacer(1, 8))
            content.append(Image(img_path, width=450, height=250))

    def add_page_number(canvas, doc):
        page_num = canvas.getPageNumber()
        canvas.drawRightString(200 * mm, 10 * mm, f"{page_num}")

    doc.build(content, onFirstPage=add_page_number, onLaterPages=add_page_number)

    pdf_data = buffer.getvalue()
    buffer.close()

    return base64.b64encode(pdf_data).decode("utf-8")


def report_agent(state: dict) -> dict:
    """Generate PDF in memory (not saved to disk) and return Base64-encoded string."""
    
    english_pdf_base64 = create_pdf_for_state(state, "English")
    
    target_lang = state.get("language", "English")
    
    if target_lang == "English":
        pdf_base64 = english_pdf_base64
    else:
        pdf_base64 = create_pdf_for_state(state, target_lang)

    return {
        "pdf_base64": pdf_base64,
        "english_pdf_base64": english_pdf_base64
    }


def conclusion_agent(state: GraphState) -> Dict[str, Any]:
    """Generate a concise conclusion summarizing the entire topic."""
    combined_text = " ".join(state["summaries"].values())
    language = state.get("language", "English")
    
    prompt = (
        f"Write a strong concluding paragraph (around 120–150 words) in English. "
        f"Give direct conclusion not any intorduction line like 'here is the conclusion'. "
        f"Summarize the key insights and future outlook for the topic '{state['topic']}'.\n"
        f"Here is the context:\n{combined_text[:2000]}"
    )
    response = groq_llm.invoke(prompt)
    conclusion_text = getattr(response, "content", str(response))
    
    return {"conclusion": conclusion_text}

graph = StateGraph(GraphState)
graph.add_node("intro", intro_agent)
graph.add_node("planner", planner_agent)
graph.add_node("retriever", retriever_agent)
graph.add_node("summarizer", summarizer_agent)
graph.add_node("analyzer", analyzer_agent)
graph.add_node("report_generator", report_agent)
graph.add_node("conclusion", conclusion_agent)

graph.add_edge(START, "intro")
graph.add_edge("intro", "planner")
graph.add_edge("planner", "retriever")
graph.add_edge("retriever", "summarizer")
graph.add_edge("summarizer", "analyzer")
graph.add_edge("analyzer", "conclusion")
graph.add_edge("conclusion", "report_generator")
graph.add_edge("report_generator", END)

app = graph.compile()

if __name__ == "__main__":
    topic = input("Enter research topic: ").strip()
    final_state = None

    for state in app.stream({"topic": topic}):
        final_state = state
        if "report_generator" in state:
            print("\n📄 Report generation in progress...")

    if final_state and "report_generator" in final_state:
        pdf_path = final_state["report_generator"].get("pdf_path")
        print(f"\n✅ Report generated successfully: {pdf_path}")
    else:
        print("⚠️ Something went wrong: report not generated.")