#!/usr/bin/env python3
"""Extract text from PDF file for AI analysis."""
import sys
import base64
import json
import pdfplumber

def extract_pdf_text(pdf_base64: str, max_chars: int = 50000) -> str:
    """Extract text from base64-encoded PDF."""
    try:
        pdf_bytes = base64.b64decode(pdf_base64)
        text_parts = []
        total_chars = 0
        
        import io
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages[:100]:  # Max 100 pages
                page_text = page.extract_text() or ""
                if total_chars + len(page_text) > max_chars:
                    remaining = max_chars - total_chars
                    if remaining > 0:
                        text_parts.append(page_text[:remaining])
                    break
                text_parts.append(page_text)
                total_chars += len(page_text)
        
        return "\n".join(text_parts)
    except Exception as e:
        return f"[PDF extraction error: {str(e)}]"

if __name__ == "__main__":
    data = json.loads(sys.stdin.read())
    pdf_base64 = data.get("pdf_base64", "")
    max_chars = data.get("max_chars", 50000)
    result = extract_pdf_text(pdf_base64, max_chars)
    print(result)