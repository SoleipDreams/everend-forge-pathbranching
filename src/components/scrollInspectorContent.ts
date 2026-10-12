/** Inspector navigation must never scroll its fixed header or tab containers. */
export function scrollInspectorContent(target:HTMLElement,block:'start'|'nearest'='start') {
  const viewport=target.closest<HTMLElement>('.inspector-scroll, .inspector-connections, .inspector-debug-content');
  if(!viewport)return;
  const bounds=viewport.getBoundingClientRect(),rect=target.getBoundingClientRect();
  const top=rect.top-bounds.top-10;
  if(block==='start' || top<0)viewport.scrollTop+=top;
  else if(rect.bottom>bounds.bottom-10)viewport.scrollTop+=Math.min(top,rect.bottom-bounds.bottom+10);
}
