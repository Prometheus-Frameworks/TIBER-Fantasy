# On The Clock - Flask Fantasy Football Platform

**Clean, modular Flask architecture for comprehensive fantasy football analytics**

## 🏗️ Project Structure

```
├── app.py                  # Main Flask application
├── modules/                # Core business logic
│   ├── __init__.py
│   ├── rankings_engine.py      # VORP ranking system
│   ├── wr_ratings_processor.py # WR 2024 CSV processing
│   ├── rookie_database.py      # 2025 rookie management
│   └── vorp_calculator.py      # Advanced VORP calculations
├── data/                   # JSON and CSV data files
│   ├── rookies.json
│   ├── WR_2024_Ratings_With_Tags.csv
│   └── [other data files]
├── templates/              # Jinja2 HTML templates
│   ├── base.html
│   ├── index.html
│   └── rankings.html
├── static/                 # CSS, JS, images
│   ├── css/style.css
│   └── js/app.js
└── flask_requirements.txt  # Python dependencies
```

## 🚀 Quick Start

### Local Deployment

1. **Install Dependencies**
   ```bash
   pip install -r flask_requirements.txt
   ```

2. **Run Application**
   ```bash
   python app.py
   ```

3. **Access Platform**
   - Open browser to `http://localhost:5000`
   - Rankings available at `http://localhost:5000/rankings`

### Production Deployment

```bash
# Using Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# Or with environment variables
FLASK_ENV=production gunicorn app:app
```

## 📊 Core Features

### VORP Rankings Engine
- **Redraft vs Dynasty modes** with format-aware scaling
- **Position filtering** (QB, RB, WR, TE, or all)
- **Superflex vs 1QB adjustments** with proper QB valuations
- **Tier groupings** based on rating gaps
- **Age penalties** for dynasty mode

### WR 2024 Analytics
- **Direct CSV processing** using authentic 2024 data
- **50 top WR performers** with adjusted ratings
- **Fantasy points per game** calculations
- **No inference or calculation** - uses only CSV fields

### 2025 Rookie Database
- **Complete 52-player coverage** from entire draft class
- **Position breakdown**: 22 RBs, 17 WRs, 7 TEs, 5 QBs, 1 K
- **ADP range**: 11.4 (A. Jeanty) to 310.5 (D. Martinez)
- **Comprehensive projections** with rushing, receiving, passing stats

## 🔌 API Endpoints

### Core Rankings
- `GET /api/rankings` - Player rankings with VORP
  - `?mode=redraft|dynasty`
  - `?position=QB|RB|WR|TE|all`
  - `?format=1qb|superflex`

### Data Access
- `GET /api/wr-ratings` - WR 2024 analytics from CSV
- `GET /api/rookies` - 2025 rookie database
  - `?position=QB|RB|WR|TE|all`
- `GET /api/vorp` - VORP calculations
  - `?mode=redraft|dynasty`
  - `?num_teams=12`

### System
- `GET /api/health` - Application health check

## ⚙️ Configuration

### Environment Variables
```bash
FLASK_ENV=development|production
PORT=5000
```

### Data Sources
- **WR Data**: `data/WR_2024_Ratings_With_Tags.csv`
- **Rookies**: `data/rookies.json`
- **Additional**: Various JSON files in `/data/`

## 🧪 Development

### Module Structure
Each module in `/modules/` follows single responsibility:
- **rankings_engine.py**: Orchestrates ranking calculations
- **wr_ratings_processor.py**: Handles WR CSV data exclusively
- **rookie_database.py**: Manages 2025 draft class
- **vorp_calculator.py**: Advanced VORP mathematics

### Template System
- **base.html**: Main layout with navigation
- **index.html**: Homepage with feature cards
- **rankings.html**: Interactive rankings interface

### Frontend Architecture
- **Vanilla JavaScript** with API integration
- **Responsive CSS Grid** layout
- **HTMX** for dynamic content loading
- **Chart.js** for data visualization

## 📈 Deployment Ready

### Portable Design
- **Self-contained modules** with clear dependencies
- **Static data files** in organized `/data/` directory
- **Clean separation** of concerns between layers
- **No external API dependencies** for core functionality

### Production Considerations
- **Gunicorn** for WSGI server
- **Environment-based configuration**
- **Static file serving** via Flask or reverse proxy
- **Database migration** ready (if needed)

---

**Built for community-driven fantasy football analytics with clean, modular architecture.**