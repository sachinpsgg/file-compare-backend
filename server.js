const express = require('express');
const cors = require('cors');
const multer = require('multer');
const natural = require('natural');
const math = require('mathjs');
const stopwords = require('stopwords').english;


const app = express();
const port = 8000;

app.use(
  cors({
    origin: 'https://file-compare-frontend.vercel.app',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  })
);


const upload = multer({ storage: multer.memoryStorage() });


function preprocessText(text) {
  
  text = text.toLowerCase();

  const tokenizer = new natural.WordTokenizer();
  let tokens = tokenizer.tokenize(text) || [];

  const punctuation = ['.', ',', '!', '?', ';', ':', '"', "'", '(', ')', '[', ']', '{', '}'];
  tokens = tokens.filter((token) => !punctuation.includes(token));

  const stopWords = new Set(stopwords.filter((word) => word.length > 2));
  tokens = tokens.filter((token) => !stopWords.has(token));

  const stemmer = natural.PorterStemmer;
  tokens = tokens.map((token) => stemmer.stem(token));

  tokens = tokens.filter((token) => token.length > 0);
  console.log('Processed tokens:', tokens);
 
  return {
    text: tokens.length > 0 ? tokens.join(' ') : text.toLowerCase(),
    tokens: tokens,
  };
}

app.post('/compare', upload.fields([{ name: 'file1' }, { name: 'file2' }]), async (req, res) => {
  try {

    const content1 = req.files['file1'][0].buffer.toString('utf-8').trim();
    const content2 = req.files['file2'][0].buffer.toString('utf-8').trim();


    const { text: text1, tokens: tokens1 } = preprocessText(content1);
    const { text: text2, tokens: tokens2 } = preprocessText(content2);

    const commonWords = [...new Set(tokens1.filter((token) => tokens2.includes(token)))];

    const tfidf = new natural.TfIdf();
    tfidf.addDocument(text1);
    tfidf.addDocument(text2);

    const terms = [
      ...new Set([
        ...Object.keys(tfidf.documents[0] || {}),
        ...Object.keys(tfidf.documents[1] || {}),
      ]),
    ];

    const vector1 = terms.map((term) => tfidf.tfidf(term, 0));
    const vector2 = terms.map((term) => tfidf.tfidf(term, 1));

    const dotProduct = math.dot(vector1, vector2);
    const norm1 = math.norm(vector1);
    const norm2 = math.norm(vector2);
    const similarity = norm1 === 0 || norm2 === 0 ? 0 : dotProduct / (norm1 * norm2);

    res.json({ similarity, commonWords });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});