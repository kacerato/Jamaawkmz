-- =====================================================
-- INSTRUÇÕES PARA CONFIGURAR O BANCO DE DADOS SUPABASE
-- =====================================================
-- Execute estes comandos no SQL Editor do seu painel Supabase
-- em: https://supabase.com/dashboard/project/dukqzrzsvvzqzutohyhj/sql

-- 1. Adicionar coluna user_id à tabela marcacoes
-- Esta coluna armazenará o ID do usuário que criou cada marcação
ALTER TABLE marcacoes
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. (OPCIONAL) Atualizar marcações existentes
-- Se você já tem marcações e quer associá-las a um usuário específico,
-- descomente e execute o comando abaixo.
-- IMPORTANTE: Isso associará TODAS as marcações existentes ao primeiro usuário.
-- Se você quiser deletar as marcações antigas ao invés de associá-las, pule este passo.

-- UPDATE marcacoes
-- SET user_id = (SELECT id FROM auth.users LIMIT 1)
-- WHERE user_id IS NULL;

-- 3. Habilitar Row Level Security (RLS)
-- Isso garante que cada usuário só possa acessar suas próprias marcações
ALTER TABLE marcacoes ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas de segurança
-- Estas políticas controlam quem pode ver, inserir, atualizar e deletar marcações

-- Política para SELECT (visualizar marcações)
DROP POLICY IF EXISTS "Users can view their own markers" ON marcacoes;
CREATE POLICY "Users can view their own markers" ON marcacoes
FOR SELECT USING (auth.uid() = user_id);

-- Política para INSERT (criar marcações)
DROP POLICY IF EXISTS "Users can insert their own markers" ON marcacoes;
CREATE POLICY "Users can insert their own markers" ON marcacoes
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política para UPDATE (atualizar marcações)
DROP POLICY IF EXISTS "Users can update their own markers" ON marcacoes;
CREATE POLICY "Users can update their own markers" ON marcacoes
FOR UPDATE USING (auth.uid() = user_id);

-- Política para DELETE (deletar marcações)
DROP POLICY IF EXISTS "Users can delete their own markers" ON marcacoes;
CREATE POLICY "Users can delete their own markers" ON marcacoes
FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- FIM DAS INSTRUÇÕES
-- =====================================================
-- Após executar estes comandos, cada usuário verá apenas suas próprias marcações.
-- O aplicativo já foi modificado para funcionar com este novo esquema.

