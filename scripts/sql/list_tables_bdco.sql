-- Liste les tables du schema bdco
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'bdco'
ORDER BY table_name;
