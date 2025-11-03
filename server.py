from flask import Flask, request, jsonify, send_from_directory
import os
from datetime import datetime
from werkzeug.utils import secure_filename
import json

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def load_reports_from_text():
    if not os.path.exists(r'c:\Users\vjp81\CPS 406\reports.txt'):
        return []
    with open(r'c:\Users\vjp81\CPS 406\reports.txt', 'r') as f:
        lines = f.readlines()
    loaded = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            loaded.append(json.loads(line))
        except:
            pass
    return loaded

def save_report_to_text(report):
    with open(r'c:\Users\vjp81\CPS 406\reports.txt', 'a') as f:
        f.write(json.dumps(report) + "\n")

reports = load_reports_from_text()
users = {}

@app.route('/api/report', methods=['POST'])
def submit_report():
    try:
        data = request.json
        all_reports = load_reports_from_text()
        report_id = len(all_reports) + 1
        
        # Validate location
        lat, lng = data['lat'], data['lng']
        if not (43.58 <= lat <= 43.86 and -79.64 <= lng <= -79.11):
            return jsonify({"error": "Location outside Toronto"}), 400
            
        # Check for duplicates
        for r in all_reports:
            dist = ((r['lat'] - lat)**2 + (r['lng'] - lng)**2)**0.5 * 111000
            if dist < 200 and r['type'] == data['type']:
                return jsonify({"error": "Duplicate report"}), 400
        
        # Save image if exists
        image_path = None
        if 'image' in data and data['image']:
            filename = f"{datetime.now().timestamp()}.jpg"
            with open(os.path.join(app.config['UPLOAD_FOLDER'], filename), 'wb') as f:
                f.write(data['image'].encode('latin1'))
            image_path = filename
        
        # Create report
        report = {
            "id": report_id,
            "lat": lat,
            "lng": lng,
            "type": data['type'],
            "description": data['description'],
            "status": "Pending",
            "userId": data['userId'],
            "image": image_path,
            "notify": data.get('notify', False),
            "timestamp": datetime.now().isoformat()
        }
        all_reports.append(report)
        save_report_to_text(report)
        
        return jsonify({"status": "success", "report_id": report_id})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/reports')
def get_reports():
    all_reports = load_reports_from_text()
    filtered = [r for r in all_reports if r['status'] != 'Resolved']
    return jsonify(filtered)

@app.route('/api/user_reports')
def user_reports():
    user_id = request.args.get('userId')
    all_reports = load_reports_from_text()
    return jsonify([r for r in all_reports if r['userId'] == user_id])

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


from flask import Flask, request, jsonify
import sqlite3
from datetime import datetime
import os

app = Flask(__name__)

# Initialize database
def init_db():
    conn = sqlite3.connect('reports.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS reports
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 lat REAL NOT NULL,
                 lng REAL NOT NULL,
                 type TEXT NOT NULL,
                 description TEXT NOT NULL,
                 status TEXT DEFAULT 'Pending',
                 user_id TEXT,
                 timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

init_db() 

@app.route('/api/report', methods=['POST'])
def submit_report():
    data = request.json
    conn = sqlite3.connect('reports.db')
    c = conn.cursor()
    
    c.execute('''INSERT INTO reports 
                 (lat, lng, type, description, user_id)
                 VALUES (?, ?, ?, ?, ?)''',
              (data['lat'], data['lng'], data['type'], 
               data['description'], data.get('user_id', 'anonymous')))
    
    report_id = c.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "report_id": report_id})

@app.route('/api/reports', methods=['GET'])
def get_reports():
    conn = sqlite3.connect('reports.db')
    c = conn.cursor()
    c.execute('SELECT * FROM reports WHERE status != "Resolved" ORDER BY timestamp DESC')
    reports = []
    for row in c.fetchall():
        reports.append({
            'id': row[0],
            'lat': row[1],
            'lng': row[2],
            'type': row[3],
            'description': row[4],
            'status': row[5],
            'user_id': row[6],
            'timestamp': row[7]
        })
    conn.close()
    return jsonify(reports)

if __name__ == '__main__':
    app.run(debug=True)