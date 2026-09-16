from fpdf import FPDF

class PDF(FPDF):
    def header(self):
        self.set_font('helvetica', 'B', 16)
        self.set_text_color(33, 37, 41)
        self.cell(0, 10, 'BhoomiAI: Intelligent Land Record Digitization System', 0, 1, 'C')
        self.set_line_width(0.5)
        self.line(10, 22, 200, 22)
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.set_text_color(128)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

    def chapter_title(self, title):
        self.set_font('helvetica', 'B', 14)
        self.set_text_color(0, 102, 204)
        self.cell(0, 10, title, 0, 1, 'L')
        self.ln(2)

    def chapter_body(self, body):
        self.set_font('helvetica', '', 11)
        self.set_text_color(0, 0, 0)
        self.multi_cell(0, 6, body)
        self.ln()

def create_pdf():
    pdf = PDF()
    pdf.add_page()
    
    # Overview
    pdf.chapter_title('1. Why This Approach Wins')
    body1 = (
        "The proposed architecture is designed not just as an AI experiment, but as a "
        "production-ready, government-grade system. While many teams will rely solely on "
        "ChatGPT wrappers, this system implements a realistic deterministic Validation Engine, "
        "secure Role-Based Access Control, an evidence-linked Human-in-the-Loop UI, and "
        "transparent AI confidence scoring. This ensures 100% technical credibility and "
        "demonstrates an understanding of the critical nature of land records."
    )
    pdf.chapter_body(body1)
    
    # Tech Stack
    pdf.chapter_title('2. Technology Stack')
    body2 = (
        "Frontend:\n"
        "- Next.js & React: High-performance user interface.\n"
        "- Tailwind CSS & Shadcn UI: Accessible, premium government-grade design.\n"
        "- React-Leaflet: Interactive GIS and parcel visualization.\n\n"
        "Backend:\n"
        "- Python & FastAPI: High-speed asynchronous APIs.\n"
        "- SQLite / PostgreSQL: Robust relational data storage.\n"
        "- SQLAlchemy: Secure Object-Relational Mapping (ORM).\n\n"
        "AI & Processing Pipeline:\n"
        "- OpenCV: Document denoising, deskewing, and contrast enhancement.\n"
        "- Tesseract OCR / PaddleOCR: Multi-lingual text extraction.\n"
        "- NLP Heuristics / LLM: Structured field extraction (Names, Khasra, Area).\n"
    )
    pdf.chapter_body(body2)
    
    # Core Features
    pdf.chapter_title('3. Core Features & Capabilities')
    body3 = (
        "- AI Field Extraction & Confidence Scoring: Extracts critical fields and flags "
        "low-confidence predictions for human review.\n"
        "- Deterministic Validation Engine: Cross-checks extracted data against reference databases "
        "and business rules (e.g., Area mismatch, duplicate survey numbers).\n"
        "- Intelligent Verification UI: Dual-pane view highlighting the document exactly where "
        "the data was extracted, allowing officers to easily correct OCR mistakes.\n"
        "- GIS Parcel Integration: Connects verified records directly to OpenStreetMap cadastral boundaries.\n"
        "- AI Intelligence Agent: A local assistant that reads application data to explain exactly "
        "why a record failed validation and what needs to be fixed.\n"
        "- Complete Audit Trails: Tamper-proof logging of who uploaded, corrected, and approved records."
    )
    pdf.chapter_body(body3)
    
    # Demo Strategy
    pdf.chapter_title('4. BhoomiAI Demo Strategy')
    body4 = (
        "The application includes a 'Demo Mode' populated with synthetic historical land records, "
        "including edge cases (blurry scans, multilingual text, conflicting area numbers). "
        "During the pitch, the team will upload a document, show the live processing pipeline, "
        "demonstrate the system successfully catching an error, use the AI agent to explain the error, "
        "and manually verify it - ending with the plot dynamically rendering on the GIS map."
    )
    pdf.chapter_body(body4)
    
    pdf.output('d:/sih/SIH_Project_Overview.pdf')

if __name__ == '__main__':
    create_pdf()

