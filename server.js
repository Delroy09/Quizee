const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Create tables and sample user
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                performance INT DEFAULT 50,
                satisfaction INT DEFAULT 50,
                burnout INT DEFAULT 50
            );
        `);
        await pool.query(`
            INSERT INTO users (username) 
            VALUES ('dylan')
            ON CONFLICT (username) DO NOTHING;
        `);
    } catch (err) {
        console.error('Database initialization error:', err);
    }
})();

// Questions array
const questions = [
  {
      id: 1,
      text: "How do you feel about your current workload?",
      options: [
          { text: "Manageable", p: 5, s: 3, b: -5 },
          { text: "Overwhelming", p: -3, s: -5, b: 7 }
      ]
  },
  {
      id: 2,
      text: "How often do you take breaks during work hours?",
      options: [
          { text: "Regularly", p: 2, s: 5, b: -4 },
          { text: "Rarely", p: -2, s: -3, b: 6 }
      ]
  },
  {
      id: 3,
      text: "How do you handle tight deadlines?",
      options: [
          { text: "Plan ahead", p: 6, s: 2, b: -3 },
          { text: "Work overtime", p: -1, s: -4, b: 5 }
      ]
  },
  {
      id: 4,
      text: "How would you rate team communication?",
      options: [
          { text: "Open and clear", p: 4, s: 5, b: -4 },
          { text: "Needs improvement", p: -3, s: -4, b: 3 }
      ]
  },
  {
      id: 5,
      text: "How does your work schedule compare to colleagues?",
      options: [
          { text: "Similar hours", p: 3, s: 2, b: -2 },
          { text: "Consistently longer", p: -2, s: -5, b: 6 }
      ]
  },
  {
      id: 6,
      text: "How often do you receive constructive feedback?",
      options: [
          { text: "Regularly", p: 5, s: 3, b: -3 },
          { text: "Rarely", p: -2, s: -2, b: 2 }
      ]
  },
  {
      id: 7,
      text: "How accessible are managers for support?",
      options: [
          { text: "Always available", p: 4, s: 5, b: -4 },
          { text: "Hard to reach", p: -3, s: -4, b: 4 }
      ]
  },
  {
      id: 8,
      text: "How satisfied are you with career growth opportunities?",
      options: [
          { text: "Clear path forward", p: 6, s: 7, b: -5 },
          { text: "Feeling stagnant", p: -4, s: -6, b: 5 }
      ]
  },
  {
      id: 9,
      text: "How often do you work through lunch?",
      options: [
          { text: "Rarely", p: 2, s: 3, b: -3 },
          { text: "Most days", p: -1, s: -4, b: 4 }
      ]
  },
  {
      id: 10,
      text: "How would you rate your work-life balance?",
      options: [
          { text: "Healthy balance", p: 3, s: 7, b: -6 },
          { text: "Work dominates", p: -2, s: -6, b: 7 }
      ]
  },
  {
      id: 11,
      text: "How often do you feel motivated at work?",
      options: [
          { text: "Most days", p: 6, s: 7, b: -5 },
          { text: "Rarely", p: -4, s: -6, b: 5 }
      ]
  },
  {
      id: 12,
      text: "How does your company handle recognition?",
      options: [
          { text: "Regular appreciation", p: 4, s: 6, b: -4 },
          { text: "Often overlooked", p: -3, s: -5, b: 4 }
      ]
  },
  {
      id: 13,
      text: "How comfortable are you delegating tasks?",
      options: [
          { text: "Confident in team", p: 5, s: 4, b: -3 },
          { text: "Prefer handling myself", p: -2, s: -2, b: 3 }
      ]
  },
  {
      id: 14,
      text: "How often do you experience work-related stress?",
      options: [
          { text: "Occasionally", p: 2, s: 3, b: -4 },
          { text: "Daily", p: -3, s: -5, b: 6 }
      ]
  },
  {
      id: 15,
      text: "How satisfied are you with company leadership?",
      options: [
          { text: "Confident in direction", p: 5, s: 6, b: -4 },
          { text: "Uncertain about strategy", p: -4, s: -5, b: 4 }
      ]
  }
];

// Routes
app.get('/', (req, res) => {
    res.send(`
        <form action="/login" method="post">
            <input type="text" name="username" placeholder="Enter username" required>
            <button type="submit">Start Quiz</button>
        </form>
    `);
});

app.post('/login', async (req, res) => {
    const { username } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            req.session.user = result.rows[0];
            req.session.answeredQuestions = [];
            res.redirect('/quiz');
        } else {
            res.send('Invalid username');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.get('/quiz', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    const user = req.session.user;
    const answered = req.session.answeredQuestions || [];
    const remaining = questions.length - answered.length;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Quiz</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .progress-container {
                    width: 300px;
                    height: 30px;
                    background-color: #eee;
                    border-radius: 15px;
                    overflow: hidden;
                    margin: 20px 0;
                    position: relative;
                }
                .progress-bar {
                    height: 100%;
                    transition: width 0.5s ease-in-out;
                }
                #performance .progress-bar { background-color: #4CAF50; }
                #satisfaction .progress-bar { background-color: #2196F3; }
                #burnout .progress-bar { background-color: #f44336; }
                .progress-text {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-weight: bold;
                    color: #333;
                }
                .question {
                    margin: 20px 0;
                    padding: 15px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                }
                button {
                    padding: 10px 20px;
                    margin: 5px;
                    cursor: pointer;
                }
            </style>
        </head>
        <body>
            <h1>Welcome ${user.username}!</h1>
            
            <div class="header">
                <div class="progress-container">
                    <div id="performance" class="progress-bar" style="width: ${user.performance}%"></div>
                    <div class="progress-text">Performance: ${user.performance}%</div>
                </div>
                
                <div class="progress-container">
                    <div id="satisfaction" class="progress-bar" style="width: ${user.satisfaction}%"></div>
                    <div class="progress-text">Satisfaction: ${user.satisfaction}%</div>
                </div>
                
                <div class="progress-container">
                    <div id="burnout" class="progress-bar" style="width: ${user.burnout}%"></div>
                    <div class="progress-text">Burnout: ${user.burnout}%</div>
                </div>
            </div>

            ${questions.filter(q => !answered.includes(q.id)).map(q => `
                <div class="question" id="q${q.id}">
                    <h3>${q.text}</h3>
                    ${q.options.map((opt, i) => `
                        <button onclick="answerQuestion(${q.id}, ${i})">${opt.text}</button>
                    `).join('')}
                </div>
            `).join('')}

            <div id="finish-section" style="display: ${remaining === 0 ? 'block' : 'none'};">
                <button onclick="window.location.href='/finish'">Finish Quiz</button>
            </div>

            <script>
                async function answerQuestion(qId, optIndex) {
                    const questionDiv = document.getElementById('q' + qId);
                    const buttons = questionDiv.getElementsByTagName('button');
                    
                    // Disable buttons immediately
                    Array.from(buttons).forEach(btn => {
                        btn.disabled = true;
                        btn.style.opacity = '0.6';
                    });

                    try {
                        const response = await fetch('/answer', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ qId, optIndex })
                        });

                        const data = await response.json();
                        if (!response.ok) throw new Error(data.error);

                        // Update progress bars
                        document.getElementById('performance').style.width = data.performance + '%';
                        document.querySelector('#performance + .progress-text').textContent = 
                            'Performance: ' + data.performance + '%';
                        
                        document.getElementById('satisfaction').style.width = data.satisfaction + '%';
                        document.querySelector('#satisfaction + .progress-text').textContent = 
                            'Satisfaction: ' + data.satisfaction + '%';
                        
                        document.getElementById('burnout').style.width = data.burnout + '%';
                        document.querySelector('#burnout + .progress-text').textContent = 
                            'Burnout: ' + data.burnout + '%';

                        // Fade out question
                        questionDiv.style.transition = 'opacity 0.5s';
                        questionDiv.style.opacity = '0';
                        setTimeout(() => questionDiv.remove(), 500);

                        // Show finish button if done
                        if (data.remaining === 0) {
                            document.getElementById('finish-section').style.display = 'block';
                        }
                    } catch (err) {
                        alert('Error: ' + err.message);
                        // Re-enable buttons on error
                        Array.from(buttons).forEach(btn => {
                            btn.disabled = false;
                            btn.style.opacity = '1';
                        });
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.post('/answer', async (req, res) => {
    const { qId, optIndex } = req.body;
    const user = req.session.user;
    
    try {
        const questionId = parseInt(qId, 10);
        const question = questions.find(q => q.id === questionId);
        
        if (!question) {
            return res.status(400).json({ error: 'Invalid question' });
        }

        if (optIndex < 0 || optIndex >= question.options.length) {
            return res.status(400).json({ error: 'Invalid option' });
        }

        const impact = question.options[optIndex];
        const result = await pool.query(`
            UPDATE users SET
                performance = GREATEST(LEAST(performance + $1, 100), 0),
                satisfaction = GREATEST(LEAST(satisfaction + $2, 100), 0),
                burnout = GREATEST(LEAST(burnout + $3, 100), 0)
            WHERE id = $4 RETURNING *
        `, [impact.p, impact.s, impact.b, user.id]);

        req.session.user = result.rows[0];
        req.session.answeredQuestions.push(questionId);
        
        res.json({
            performance: result.rows[0].performance,
            satisfaction: result.rows[0].satisfaction,
            burnout: result.rows[0].burnout,
            remaining: questions.length - req.session.answeredQuestions.length
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/finish', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    res.send('<h1 style="text-align: center; margin-top: 100px;">Hurrah! You completed the quiz!</h1>');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});