import re
with open('d:/sih/backend/app/routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    results = []
    for rec in records:
        d = row_to_dict(rec)
        # Attach document info
        doc = db.query(Document).filter(Document.id == rec.document_id).first()
        if doc:
            d["document"] = {
                "id": doc.id,
                "filename": doc.filename,
                "status": doc.status,
                "upload_date": doc.upload_date.isoformat() if doc.upload_date else None,
            }
        results.append(d)

    return {"results": results, "total": total}'''

replacement = '''    results = []
    found_survey_numbers = set()

    for rec in records:
        d = row_to_dict(rec)
        if d.get("survey_number"):
            found_survey_numbers.add(d["survey_number"])
            # Pull in Parcel pricing info if available
            p = db.query(Parcel).filter(Parcel.survey_number == d["survey_number"]).first()
            if p:
                d["land_classification"] = p.land_classification
                d["circle_rate_per_sqm"] = p.circle_rate_per_sqm

        # Attach document info
        doc = db.query(Document).filter(Document.id == rec.document_id).first()
        if doc:
            d["document"] = {
                "id": doc.id,
                "filename": doc.filename,
                "status": doc.status,
                "upload_date": doc.upload_date.isoformat() if doc.upload_date else None,
            }
        results.append(d)

    # Search raw Parcels directly if the query looks like a survey number or village
    if not status:
        parcel_matches = db.query(Parcel).filter(
            or_(
                Parcel.survey_number.ilike(f"%{q}%"),
                Parcel.village.ilike(f"%{q}%"),
                Parcel.district.ilike(f"%{q}%")
            )
        ).limit(10).all()

        for p in parcel_matches:
            if p.survey_number not in found_survey_numbers:
                results.append({
                    "id": f"parcel_{p.id}",
                    "survey_number": p.survey_number,
                    "village": p.village,
                    "district": p.district,
                    "area": p.area,
                    "land_classification": p.land_classification,
                    "circle_rate_per_sqm": p.circle_rate_per_sqm,
                    "owner_name": "No Document Uploaded",
                    "validation_status": "Govt Reference",
                })
                total += 1

    return {"results": results, "total": total}'''

content = content.replace(target, replacement)

with open('d:/sih/backend/app/routes.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
