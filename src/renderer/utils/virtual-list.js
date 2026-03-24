class VirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 60;
    this.bufferSize = options.bufferSize || 5;
    this.renderItem = options.renderItem || (() => '');
    this.items = [];
    this.renderedItems = new Map();
    this.scrollTop = 0;
    this.containerHeight = 0;
    this.useVirtual = options.useVirtual !== false;
    
    this.init();
  }

  init() {
    this.container.style.overflow = 'auto';
    this.container.style.position = 'relative';
    
    this.sentinel = document.createElement('div');
    this.sentinel.style.height = '0';
    this.sentinel.style.width = '1px';
    this.sentinel.style.position = 'absolute';
    this.container.appendChild(this.sentinel);
    
    this.content = document.createElement('div');
    this.content.className = 'virtual-list-content';
    this.content.style.position = 'relative';
    this.container.appendChild(this.content);
    
    this.container.addEventListener('scroll', this.onScroll.bind(this));
    
    this.updateDimensions();
  }

  updateDimensions() {
    this.containerHeight = this.container.clientHeight;
    this.scrollTop = this.container.scrollTop;
  }

  onScroll() {
    this.updateDimensions();
    this.render();
  }

  setItems(items) {
    this.items = items || [];
    this.renderedItems.clear();
    
    const totalHeight = this.items.length * this.itemHeight;
    this.content.style.height = `${totalHeight}px`;
    
    this.render();
  }

  getVisibleRange() {
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const endIndex = Math.min(this.items.length, startIndex + visibleCount + this.bufferSize * 2);
    
    return { startIndex, endIndex };
  }

  render() {
    if (!this.useVirtual || this.items.length === 0) {
      this.renderAll();
      return;
    }

    const { startIndex, endIndex } = this.getVisibleRange();
    
    const existingKeys = new Set();
    const newKeys = new Set();
    
    for (const [key] of this.renderedItems) {
      existingKeys.add(key);
    }
    
    for (let i = startIndex; i < endIndex; i++) {
      newKeys.add(i);
    }
    
    for (const key of existingKeys) {
      if (!newKeys.has(key)) {
        const el = this.renderedItems.get(key);
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
        this.renderedItems.delete(key);
      }
    }
    
    for (let i = startIndex; i < endIndex; i++) {
      if (!this.renderedItems.has(i)) {
        const item = this.items[i];
        const el = document.createElement('div');
        el.className = 'virtual-list-item';
        el.style.position = 'absolute';
        el.style.top = `${i * this.itemHeight}px`;
        el.style.left = '0';
        el.style.right = '0';
        el.style.height = `${this.itemHeight}px`;
        el.innerHTML = this.renderItem(item, i);
        this.content.appendChild(el);
        this.renderedItems.set(i, el);
      }
    }
  }

  renderAll() {
    this.content.innerHTML = '';
    this.renderedItems.clear();
    
    if (!this.useVirtual) {
      this.content.style.height = 'auto';
      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        const el = document.createElement('div');
        el.className = 'virtual-list-item';
        el.innerHTML = this.renderItem(item, i);
        this.content.appendChild(el);
        this.renderedItems.set(i, el);
      }
    } else {
      const totalHeight = this.items.length * this.itemHeight;
      this.content.style.height = `${totalHeight}px`;
      this.render();
    }
  }

  scrollTo(index) {
    if (index < 0 || index >= this.items.length) return;
    
    const targetTop = index * this.itemHeight;
    this.container.scrollTop = targetTop - this.containerHeight / 2 + this.itemHeight / 2;
    this.updateDimensions();
    this.render();
  }

  scrollToTop() {
    this.container.scrollTop = 0;
    this.updateDimensions();
    this.render();
  }

  refresh() {
    this.updateDimensions();
    this.render();
  }

  destroy() {
    this.container.removeEventListener('scroll', this.onScroll);
    this.content.innerHTML = '';
    this.renderedItems.clear();
    this.items = [];
    
    if (this.sentinel && this.sentinel.parentNode) {
      this.sentinel.parentNode.removeChild(this.sentinel);
    }
    if (this.content && this.content.parentNode) {
      this.content.parentNode.removeChild(this.content);
    }
  }

  getStats() {
    return {
      totalItems: this.items.length,
      renderedItems: this.renderedItems.size,
      useVirtual: this.useVirtual,
      containerHeight: this.containerHeight,
      scrollTop: this.scrollTop
    };
  }
}

window.VirtualList = VirtualList;
