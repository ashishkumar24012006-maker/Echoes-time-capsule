const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
import './delete.css';

function enhanceMediaControls() {
  document.querySelectorAll('select').forEach(select => {
    if (![...select.options].some(option => option.value === 'text') && [...select.options].some(option => option.value === 'video')) {
      select.add(new Option('Text', 'text'));
    }
  });

  document.querySelectorAll('select').forEach(select => {
    if (select.dataset.mediaEnhanced) return;
    select.dataset.mediaEnhanced = 'true';
    select.addEventListener('change', () => {
      const urlInput = select.closest('.form-row')?.querySelector('input[type="url"], input[type="text"]');
      if (!urlInput || !['image', 'audio', 'video', 'text'].includes(select.value)) return;
      urlInput.type = select.value === 'text' ? 'text' : 'url';
      urlInput.placeholder = select.value === 'text' ? 'Write attachment text…' : 'https://…';
    });
  });

  document.querySelectorAll('.capsule-card').forEach(card => {
    if (card.querySelector('.capsule-delete')) return;
    const link = card.closest('a') || card.querySelector('a');
    const id = link?.getAttribute('href')?.split('/').pop();
    if (!id) return;
    const button = document.createElement('button');
    button.className = 'capsule-delete';
    button.type = 'button';
    button.textContent = 'Delete';
    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      if (!window.confirm('Delete this capsule permanently?')) return;
      const response = await fetch(`${apiBase}/capsules/${id}`, { method: 'DELETE', credentials: 'include' });
      if (response.ok) card.remove();
    });
    card.append(button);
  });

  document.querySelectorAll('.memory-media-list').forEach(list => {
    list.querySelectorAll('.fine-print').forEach(label => {
      if (label.textContent.trim().toLowerCase() !== 'text' || label.previousElementSibling?.tagName !== 'VIDEO') return;
      const video = label.previousElementSibling;
      const text = document.createElement('p');
      text.className = 'memory-text';
      text.textContent = video.getAttribute('src') || '';
      video.replaceWith(text);
    });
  });
}

new MutationObserver(enhanceMediaControls).observe(document.body, { childList: true, subtree: true });
enhanceMediaControls();
