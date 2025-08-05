-- Add to your init.lua or init.vim

-- Set up the squiggle language server
require('lspconfig').squiggle_lsp.setup {
  cmd = { "node", "/path/to/squiggle-lsp/dist/server.js", "--stdio" },
  filetypes = { "squiggle" },
  root_dir = function(fname)
    return require('lspconfig').util.find_git_ancestor(fname) or
           vim.fn.getcwd()
  end,
  settings = {
    -- Any server-specific settings would go here
  }
}

-- Register .sq files as squiggle
vim.cmd [[
  augroup Squiggle
    autocmd!
    autocmd BufNewFile,BufRead *.sq setfiletype squiggle
  augroup END
]]

-- Basic highlighting for Squiggle files
vim.cmd [[
  syntax match squiggleKeyword "\<\(squiggle\|draw\|line\|curve\|color\|width\|style\|dotted\|dashed\|solid\|arrow\|label\|connect\|point\|group\|layer\|export\)\>"
  highlight link squiggleKeyword Keyword
]]
