export function createMultiSelect({ label, options, onChange, renderOption }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'control-item multiselect';

  const lbl = document.createElement('strong');
  lbl.textContent = label;
  wrapper.appendChild(lbl);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'multiselect-trigger';
  trigger.setAttribute('aria-expanded', 'false');

  const labelSpan = document.createElement('span');
  labelSpan.className = 'multiselect-label';

  const arrow = document.createElement('span');
  arrow.className = 'multiselect-arrow';
  arrow.textContent = '▾';

  trigger.appendChild(labelSpan);
  trigger.appendChild(arrow);
  wrapper.appendChild(trigger);

  const panel = document.createElement('div');
  panel.className = 'multiselect-panel hidden';
  wrapper.appendChild(panel);

  const selected = new Set();
  const itemCheckboxes = [];

  function updateTriggerText() {
    if (selected.size === 0 || selected.size === options.length) {
      labelSpan.textContent = 'All';
    } else if (selected.size === 1) {
      labelSpan.textContent = [...selected][0];
    } else {
      labelSpan.textContent = `${selected.size} selected`;
    }
  }

  function emit() {
    const result = selected.size === 0 || selected.size === options.length
      ? null
      : new Set(selected);
    onChange(result);
  }

  // Master "All" row, rendered first so it sits at the top of the panel.
  const allRow = document.createElement('label');
  allRow.className = 'multiselect-option multiselect-all';
  const allCb = document.createElement('input');
  allCb.type = 'checkbox';
  allRow.appendChild(allCb);
  const allTxt = document.createElement('span');
  allTxt.className = 'multiselect-all-label';
  allTxt.textContent = 'All';
  allRow.appendChild(allTxt);
  panel.appendChild(allRow);

  function syncAllCheckbox() {
    if (selected.size === 0) {
      allCb.checked = false;
      allCb.indeterminate = false;
    } else if (selected.size === options.length) {
      allCb.checked = true;
      allCb.indeterminate = false;
    } else {
      allCb.checked = false;
      allCb.indeterminate = true;
    }
  }

  allCb.addEventListener('change', () => {
    if (allCb.checked) {
      // Select every option.
      selected.clear();
      for (const opt of options) selected.add(opt.value);
      itemCheckboxes.forEach(cb => { cb.checked = true; });
    } else {
      // Clear all options.
      selected.clear();
      itemCheckboxes.forEach(cb => { cb.checked = false; });
    }
    allCb.indeterminate = false;
    updateTriggerText();
    emit();
  });

  for (const opt of options) {
    const row = document.createElement('label');
    row.className = 'multiselect-option';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = opt.value;
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(opt.value);
      else selected.delete(opt.value);
      syncAllCheckbox();
      updateTriggerText();
      emit();
    });
    itemCheckboxes.push(cb);
    row.appendChild(cb);
    if (renderOption) {
      row.appendChild(renderOption(opt));
    } else {
      const txt = document.createElement('span');
      txt.textContent = opt.label;
      row.appendChild(txt);
    }
    panel.appendChild(row);
  }

  function open() {
    panel.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
  }
  function close() {
    panel.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
  }
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.classList.contains('hidden')) open();
    else close();
  });
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) close();
  });

  wrapper.clearSelection = function () {
    selected.clear();
    itemCheckboxes.forEach(cb => { cb.checked = false; });
    allCb.checked = false;
    allCb.indeterminate = false;
    updateTriggerText();
  };

  syncAllCheckbox();
  updateTriggerText();
  return wrapper;
}
