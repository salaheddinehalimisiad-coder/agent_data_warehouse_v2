path = r'c:\Users\salah\Desktop\agent_dw_v3_fixed\app_fixed\src\components\ConnectionModal.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the doUpload function to add a timeout and not get stuck
old = """  const doUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setError('');
    try {
      const res = await apiClient.uploadCsv(file);
      setSourceConfig(prev => ({ ...prev, file_path: res.file_path, filename: res.filename }));
    } catch (err) {
      setError(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };"""

new = """  const doUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setError('');
    // Safety timeout: never stay stuck more than 15s
    const timeout = setTimeout(() => {
      setIsUploading(false);
      setError('Upload timeout — veuillez réessayer.');
    }, 15000);
    try {
      const res = await apiClient.uploadCsv(file);
      clearTimeout(timeout);
      setSourceConfig(prev => ({ ...prev, file_path: res.file_path, filename: res.filename }));
    } catch (err) {
      clearTimeout(timeout);
      setError(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };"""

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('TIMEOUT PATCH OK')
else:
    print('Pattern not found — checking...')
    idx = content.find('doUpload')
    print(repr(content[idx:idx+400]))
