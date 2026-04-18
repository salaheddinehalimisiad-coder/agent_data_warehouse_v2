import sys
try:
    import docx
    doc = docx.Document(r'c:\Users\salah\Desktop\agent_dw_v3_fixed\roadmap_generique_phase3.docx')
    fullText = []
    for para in doc.paragraphs:
        fullText.append(para.text)
    content = '\n'.join(fullText)
    with open(r'c:\Users\salah\Desktop\agent_dw_v3_fixed\scratch\roadmap_content.txt', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success: content written to scratch/roadmap_content.txt")
except ImportError:
    print("python-docx not installed")
except Exception as e:
    print(f"Error: {e}")
