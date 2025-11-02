import Editor from '@monaco-editor/react';

/**
 * CodeEditor component using Monaco
 * Props: value, language, onChange, height, theme, options
 */
const CodeEditor = ({ value, language = 'javascript', onChange, height = '400px', theme = 'vs-dark', options = {} }) => {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <Editor
        height={height}
        defaultLanguage={language}
        language={language}
        value={value}
        onChange={(val) => onChange?.(val || '')}
        theme={theme}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          renderValidationDecorations: 'on',
          ...options,
        }}
      />
    </div>
  );
};

export default CodeEditor;
