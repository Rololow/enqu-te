(() => {
    const pageConfig = window.INVESTIGATION_PAGE_CONTEXT || {};
    const config = {
        investigationId: pageConfig.investigationId ? String(pageConfig.investigationId) : '',
        csrfToken: pageConfig.csrfToken ? String(pageConfig.csrfToken) : '',
        currentUserId: pageConfig.currentUserId ? String(pageConfig.currentUserId) : '',
        userRole: pageConfig.userRole ? String(pageConfig.userRole) : '',
        investigationOwnerId: pageConfig.investigationOwnerId ? String(pageConfig.investigationOwnerId) : '',
        currentView: pageConfig.currentView ? String(pageConfig.currentView) : 'timeline'
    };

    // Investigation App JavaScript
    class InvestigationApp {
        constructor(initialConfig) {
            this.investigationId = initialConfig.investigationId;
            this.currentView = initialConfig.currentView || 'timeline';
            this.entities = [];
            this.links = [];
            this.editingEntity = null;
            this.activeDetailEntityId = null;
            this.networkChart = null;
            this.members = [];
            this.membersLoaded = false;
            this.currentUserId = initialConfig.currentUserId;
            this.userRole = initialConfig.userRole;
            this.investigationOwnerId = initialConfig.investigationOwnerId;
            this.isOwner = this.userRole === 'owner';
            this.csrfToken = initialConfig.csrfToken;
            this.activeTypeFilters = new Set();
            this.attributeFilters = {
                has_description: false,
                has_links: false
            };
            this.sortOption = 'updated_desc';
            this.searchTermRaw = '';
            this.searchTerm = '';
            this.linkCountMap = new Map();
            this.availableTags = [];
            this.newEntityTags = [];
            this.editingEntityTags = [];
            this.currentFormMode = null;
            this.currentFormType = null;

            this.init();
        }

        init() {
            this.captureInitialFilterState();
            this.loadData();
            this.setupEventListeners();
            this.startPresence();
            this.startHeartbeat();
            this.startAutoSync();
        }

        captureInitialFilterState() {
            const searchInput = document.getElementById('searchInput');
            this.searchTermRaw = searchInput ? searchInput.value : '';
            this.searchTerm = (this.searchTermRaw || '').toLowerCase();

            const sortSelect = document.getElementById('sortSelect');
            this.sortOption = sortSelect ? sortSelect.value : 'updated_desc';
            this.resetTypeFilters(true);
            this.resetAttributeFilters(true);
            this.updateActiveFilterChips();
        }
            this.sortOption = sortSelect ? sortSelect.value : 'updated_desc';

            this.resetTypeFilters(true);
            this.resetAttributeFilters(true);
            this.updateActiveFilterChips();
        }

        setupEventListeners() {
            // Close modals on outside click
            document.getElementById('addModal').addEventListener('click', (e) => {
                if (e.target.id === 'addModal') this.closeAddModal();
            });

            document.getElementById('editModal').addEventListener('click', (e) => {
                if (e.target.id === 'editModal') this.closeEditModal();
            });

            document.getElementById('linkModal').addEventListener('click', (e) => {
                if (e.target.id === 'linkModal') this.closeLinkModal();
            });

            const detailModal = document.getElementById('entityDetailModal');
            if (detailModal) {
                detailModal.addEventListener('click', (e) => {
                    if (e.target.id === 'entityDetailModal') {
                        this.closeEntityDetail();
                    }
                });
            }

            const addTypeModal = document.getElementById('addTypeModal');
            if (addTypeModal) {
                addTypeModal.addEventListener('click', (e) => {
                    if (e.target.id === 'addTypeModal') this.closeAddTypeModal();
                });
            }

            const settingsModal = document.getElementById('investigationSettingsModal');
            if (settingsModal) {
                settingsModal.addEventListener('click', (e) => {
                    if (e.target.id === 'investigationSettingsModal') {
                        this.closeInvestigationSettingsModal();
                    }
                });
            }

            const deleteInvestigationBtn = document.getElementById('deleteInvestigationBtn');
            if (deleteInvestigationBtn) {
                deleteInvestigationBtn.addEventListener('click', () => this.deleteInvestigation());
            }

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    this.closeAddModal();
                    this.closeEditModal();
                    this.closeLinkModal();
                    this.closeAddTypeModal();
                    this.closeInvestigationSettingsModal();
                    this.closeEntityDetail();
                    document.getElementById('filterDropdown')?.classList.add('hidden');
                }
            });
        }

        async loadData() {
            try {
                const [entitiesResponse, linksResponse] = await Promise.all([
                    fetch(`/api/investigation/${this.investigationId}/entities/`),
                    fetch(`/api/investigation/${this.investigationId}/links/`)
                ]);

                this.entities = (await entitiesResponse.json()).entities;
                this.links = (await linksResponse.json()).links;
                this.linkCountMap = this.buildLinkCountMap();

                // Populate checkbox filters for persons, locations and events
                try {
                    const persons = this.entities
                        .filter(e => e.type === 'person')
                        .sort((a, b) => a.title.localeCompare(b.title));
                    const personsContainer = document.getElementById('personsList');
                    if (personsContainer) {
                        personsContainer.innerHTML = '';
                        persons.forEach(p => {
                            const id = `filter_person_${p.id}`;
                            const wrapper = document.createElement('label');
                            wrapper.className = 'inline-flex items-center space-x-2 px-2 py-1 bg-slate-800/80 hover:bg-slate-700 rounded';
                            wrapper.innerHTML = `<input type="checkbox" id="${id}" value="${p.id}" onchange="applyFilters()"> <span class="text-slate-300 text-sm">${p.title}</span>`;
                            personsContainer.appendChild(wrapper);
                        });
                    }

                    const places = this.entities
                        .filter(e => e.type === 'location')
                        .sort((a, b) => a.title.localeCompare(b.title));
                    const placesContainer = document.getElementById('placesList');
                    if (placesContainer) {
                        placesContainer.innerHTML = '';
                        places.forEach(place => {
                            const id = `filter_place_${place.id}`;
                            const wrapper = document.createElement('label');
                            wrapper.className = 'flex flex-col gap-1 px-2 py-2 bg-slate-800/80 hover:bg-slate-700 rounded';
                            const subtitle = (place.address || place.location || '').trim();
                            wrapper.innerHTML = `
                                <span class="inline-flex items-center space-x-2">
                                    <input type="checkbox" id="${id}" value="${place.id}" onchange="applyFilters()">
                                    <span class="text-slate-300 text-sm">${place.title}</span>
                                </span>
                                ${subtitle ? `<span class="pl-6 text-xs text-slate-500">${subtitle}</span>` : ''}
                            `;
                            placesContainer.appendChild(wrapper);
                        });
                    }

                    const events = this.entities
                        .filter(e => e.type === 'event')
                        .sort((a, b) => a.title.localeCompare(b.title));
                    const eventsContainer = document.getElementById('eventsList');
                    if (eventsContainer) {
                        eventsContainer.innerHTML = '';
                        events.forEach(ev => {
                            const id = `filter_event_${ev.id}`;
                            const wrapper = document.createElement('label');
                            wrapper.className = 'inline-flex items-center space-x-2 px-2 py-1 bg-slate-800/80 hover:bg-slate-700 rounded';
                            wrapper.innerHTML = `<input type="checkbox" id="${id}" value="${ev.id}" onchange="applyFilters()"> <span class="text-slate-300 text-sm">${ev.title}</span>`;
                            eventsContainer.appendChild(wrapper);
                        });
                    }
                } catch (e) {
                    console.warn('Could not populate checkbox filters', e);
                }

                this.refreshView();
                this.refreshEntityDetail();
                this.updateActiveFilterChips();
                // also refresh presence immediately after loading data
                this.fetchPresence();
            } catch (error) {
                console.error('Error loading data:', error);
            }
        }

        // Presence polling & heartbeat
        async fetchPresence() {
            try {
                const res = await fetch(`/api/investigation/${this.investigationId}/presence/`);
                if (!res.ok) return [];
                const data = await res.json();
                const members = data.members || [];
                this.renderPresence(members);
                return members;
            } catch (e) {
                console.error('Error fetching presence', e);
                return [];
            }
        }

        renderPresence(members) {
            const container = document.getElementById('presenceBubbles');
            if (!container) return;
            this.members = members;
            this.membersLoaded = true;
            container.innerHTML = '';
            members.forEach(m => {
                const el = document.createElement('div');
                el.className = 'relative';
                el.title = (m.username) + (m.online ? ' — en ligne' : ' — hors ligne');
                const avatar = document.createElement('div');
                avatar.className = 'w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm text-white overflow-hidden';
                if (m.avatar) {
                    const img = document.createElement('img');
                    img.src = m.avatar;
                    img.alt = m.username;
                    img.className = 'w-full h-full object-cover';
                    avatar.appendChild(img);
                } 

        renderMemberAccessList() {
            if (!this.isOwner) return;
            const container = document.getElementById('investigationMembersList');
            if (!container) return;

            if (!this.membersLoaded) {
                container.innerHTML = '<div class="text-sm text-slate-400">Chargement des membres...</div>';
                return;
            }

            if (!Array.isArray(this.members) || this.members.length === 0) {
                container.innerHTML = '<div class="text-sm text-slate-400">Aucun membre pour le moment.</div>';
                return;
            }

            const roleLabels = {
                owner: 'Propriétaire',
                admin: 'Administrateur',
                member: 'Membre',
                viewer: 'Observateur'
            };

            container.innerHTML = '';

            this.members.forEach(member => {
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-3';

                const info = document.createElement('div');
                info.className = 'flex items-center gap-3';

                const avatar = document.createElement('div');
                avatar.className = 'w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm text-white overflow-hidden';
                if (member.avatar) {
                    const img = document.createElement('img');
                    img.src = member.avatar;
                    img.alt = member.username;
                    img.className = 'w-full h-full object-cover';
                    avatar.appendChild(img);
                } else {
                    avatar.textContent = (member.username || '?').charAt(0).toUpperCase();
                }

                const details = document.createElement('div');
                details.className = 'flex flex-col';

                const nameLine = document.createElement('div');
                nameLine.className = 'flex items-center gap-2';
                const name = document.createElement('span');
                name.className = 'text-sm font-semibold text-slate-100';
                name.textContent = member.username || 'Utilisateur';

                const roleBadge = document.createElement('span');
                roleBadge.className = 'px-2 py-0.5 text-[11px] rounded-full bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wide';
                roleBadge.textContent = roleLabels[member.role] || member.role;

                nameLine.appendChild(name);
                nameLine.appendChild(roleBadge);

                const status = document.createElement('span');
                status.className = `text-xs ${member.online ? 'text-emerald-400' : 'text-slate-500'}`;
                status.textContent = member.online ? 'En ligne' : 'Hors ligne';

                details.appendChild(nameLine);
                details.appendChild(status);

                info.appendChild(avatar);
                info.appendChild(details);
                row.appendChild(info);

                const canRemove = this.isOwner && member.role !== 'owner' && String(member.id) !== String(this.currentUserId);
                const actions = document.createElement('div');
                actions.className = 'flex items-center gap-2';

                if (canRemove) {
                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'px-3 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors flex items-center gap-2';
                    removeBtn.innerHTML = '<i class="fas fa-user-slash"></i><span>Retirer l\'accès</span>';
                    removeBtn.addEventListener('click', () => this.revokeMember(member.id, removeBtn));
                    actions.appendChild(removeBtn);
                } else {
                    const hint = document.createElement('span');
                    hint.className = 'text-xs text-slate-500';
                    hint.textContent = member.role === 'owner' ? 'Propriétaire' : 'Accès non modifiable';
                    actions.appendChild(hint);
                }

                row.appendChild(actions);
                container.appendChild(row);
            });
        }

        refreshTagMetadata() {
            const tagMap = new Map();
            this.availableTags = [];

            this.entities.forEach(entity => {
                if (!Array.isArray(entity.tags)) return;
                entity.tags.forEach(tag => {
                    const labelRaw = tag && typeof tag.name === 'string' ? tag.name : '';
                    const label = this.formatTagLabel(labelRaw);
                    const value = this.normalizeTagValue(label);
                    if (!value || tagMap.has(value)) {
                        return;
                    }
                    tagMap.set(value, { label, value });
                });
            });

            this.availableTags = Array.from(tagMap.values()).sort((a, b) => a.label.localeCompare(b.label));
        }

        isDetailOpen() {
            const modal = document.getElementById('entityDetailModal');
            return Boolean(modal && !modal.classList.contains('hidden'));
        }

        openEntityDetail(entityId) {
            const entity = this.entities.find(e => String(e.id) === String(entityId));
            if (!entity) {
                this.showNotification('Élément introuvable', 'error');
                return;
            }

            this.activeDetailEntityId = String(entity.id);
            const modal = document.getElementById('entityDetailModal');
            if (!modal) return;

            this.populateEntityDetail(entity);
            modal.classList.remove('hidden');

            const drawer = modal.querySelector('.overflow-y-auto');
            if (drawer) {
                drawer.scrollTop = 0;
            }
        }

        closeEntityDetail() {
            const modal = document.getElementById('entityDetailModal');
            if (!modal) return;
            modal.classList.add('hidden');
            this.activeDetailEntityId = null;
        }

        refreshEntityDetail() {
            if (!this.activeDetailEntityId || !this.isDetailOpen()) {
                return;
            }
            const entity = this.entities.find(e => String(e.id) === String(this.activeDetailEntityId));
            if (!entity) {
                this.closeEntityDetail();
                return;
            }
            this.populateEntityDetail(entity);
        }

        populateEntityDetail(entity) {
            const titleEl = document.getElementById('entityDetailTitle');
            const typeEl = document.getElementById('entityDetailType');
            const contentEl = document.getElementById('entityDetailContent');
            const editBtn = document.getElementById('entityDetailEditBtn');

            if (!contentEl || !titleEl || !typeEl) return;

            const typeLabels = {
                person: 'Personne',
                location: 'Lieu',
                evidence: 'Preuve',
                event: 'Événement'
            };

            titleEl.textContent = entity.title || 'Sans titre';
            typeEl.textContent = typeLabels[entity.type] || 'Élément';

            if (editBtn) {
                editBtn.onclick = () => {
                    this.closeEntityDetail();
                    this.editEntity(entity.id);
                };
            }

            const metaRows = this.buildEntityMetaRows(entity);
            const linkedEntities = this.getLinkedEntitiesOverview(entity.id);
            const safeLinkedEntities = linkedEntities.map(item => ({
                entity: {
                    id: item.entity.id,
                    type: item.entity.type,
                    title: item.entity.title ? this.escapeHtml(item.entity.title) : 'Sans titre'
                },
                relations: item.relations
                    .map(rel => this.escapeHtml(rel))
                    .filter(Boolean)
            }));
            const descriptionHtml = entity.description
                ? this.renderMarkdown(entity.description)
                : '<p class="text-sm text-slate-500 italic">Aucune description pour le moment.</p>';

            const hasDescription = Boolean(entity.description && entity.description.trim());
            const hasMeta = metaRows.length > 0;
            const hasLinked = safeLinkedEntities.length > 0;

            const introToastEl = document.getElementById('entityDetailEmptyHint');
            if (introToastEl) {
                introToastEl.classList.toggle('hidden', hasDescription || hasMeta || hasLinked);
            }

            const metaSection = metaRows.length ? `
                <section class="space-y-3">
                    <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-[0.2em]">Informations clés</h3>
                    <dl class="space-y-3">
                        ${metaRows.map(row => `
                            <div class="flex items-start justify-between gap-4 pb-3 border-b border-slate-800 last:border-transparent">
                                <dt class="text-xs uppercase tracking-[0.2em] text-slate-500">${row.label}</dt>
                                <dd class="text-sm text-slate-100 text-right">${row.value}</dd>
                            </div>
                        `).join('')}
                    </dl>
                </section>
            ` : '';

            const descriptionSection = `
                <section class="space-y-3">
                    <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-[0.2em]">Description</h3>
                    ${hasDescription ? `
                        <div class="prose prose-invert prose-sm max-w-none leading-relaxed">
                            ${descriptionHtml}
                        </div>
                    ` : '<p class="text-sm text-slate-500 italic">Aucune description pour le moment.</p>'}
                </section>
            `;

            const linkedSection = `
                <section class="space-y-3">
                    <div class="flex items-center justify-between">
                        <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-[0.2em]">Liens</h3>
                        <button type="button" class="text-xs text-blue-400 hover:text-blue-300" onclick="app.openLinkModal('${entity.id}')">
                            <i class="fas fa-plus mr-1"></i>Ajouter un lien
                        </button>
                    </div>
                    ${safeLinkedEntities.length ? `
                        <ul class="space-y-2">
                            ${safeLinkedEntities.map(item => `
                                <li class="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                                    <div>
                                        <div class="text-sm font-medium text-slate-100">${item.entity.title}</div>
                                        <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">${typeLabels[item.entity.type] || item.entity.type}</div>
                                        ${item.relations.length ? `<div class="mt-1 flex flex-wrap gap-1">
                                            ${item.relations.map(rel => `<span class="px-2 py-0.5 text-[11px] rounded-full bg-slate-900 border border-slate-700 text-slate-300">${rel}</span>`).join('')}
                                        </div>` : ''}
                                    </div>
                                    <button type="button" class="px-2 py-1 text-xs bg-slate-900/80 border border-slate-700 rounded-md hover:border-slate-500 text-slate-200"
                                            onclick="event.stopPropagation(); app.openEntityDetail('${item.entity.id}')">
                                        Ouvrir
                                    </button>
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p class="text-sm text-slate-500 italic">Aucun lien pour le moment.</p>'}
                </section>
            `;

            const createdLabel = this.escapeHtml(this.formatDateTimeDisplay(entity.created_at));
            const updatedLabel = entity.updated_at ? this.escapeHtml(this.formatDateTimeDisplay(entity.updated_at)) : null;

            const auditSection = `
                <section class="space-y-2 text-xs text-slate-500">
                    <div>Créé le ${createdLabel}</div>
                    ${updatedLabel ? `<div>Mis à jour le ${updatedLabel}</div>` : ''}
                </section>
            `;

            contentEl.innerHTML = [metaSection, descriptionSection, linkedSection, auditSection]
                .filter(Boolean)
                .join('\n');
        }

        buildEntityMetaRows(entity) {
            const rows = [];
            const pushRow = (label, value) => {
                if (value !== null && value !== undefined && value !== '') {
                    rows.push({
                        label,
                        value: this.escapeHtml(value)
                    });
                }
            };

            switch (entity.type) {
                case 'person':
                    pushRow('Rôle', entity.role || '—');
                    break;
                case 'location':
                    pushRow('Zone / Ville', entity.location || '—');
                    pushRow('Adresse', entity.address || '—');
                    break;
                case 'evidence':
                    pushRow('Type de preuve', entity.evidence_type || '—');
                    break;
                case 'event':
                    pushRow('Début', this.formatDateTimeDisplay(entity.event_date));
                    pushRow('Fin', this.formatDateTimeDisplay(entity.event_end_date));
                    if (entity.is_timeslot) {
                        pushRow('Précision', 'Créneau approximatif');
                    }
                    const linkedLocations = this.getLinkedLocations(entity.id);
                    if (linkedLocations.length) {
                        pushRow('Lieux associés', linkedLocations.map(loc => loc.title).join(', '));
                    }
                    break;
            }

            if (entity.created_by) {
                pushRow('Créé par', entity.created_by);
            }

            return rows;
        }

        formatDateTimeDisplay(value) {
            if (!value) return '—';
            try {
                const hasTime = typeof value === 'string' && value.includes('T') && value.includes(':');
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) {
                    return value;
                }
                const options = hasTime
                    ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
                    : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
                return date.toLocaleString('fr-FR', options);
            } catch (error) {
                return value;
            }
        }

        formatDateTimeForInput(value) {
            if (!value) return '';
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) {
                if (typeof value === 'string') {
                    return value.slice(0, 16);
                }
                return '';
            }
            const pad = (num) => String(num).padStart(2, '0');
            const year = date.getFullYear();
            const month = pad(date.getMonth() + 1);
            const day = pad(date.getDate());
            const hours = pad(date.getHours());
            const minutes = pad(date.getMinutes());
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }

        getLinkedEntitiesOverview(entityId) {
            const targetId = String(entityId);
            const grouped = new Map();

            const addRelation = (otherEntity, label) => {
                if (!otherEntity) return;
                const key = String(otherEntity.id);
                if (!grouped.has(key)) {
                    grouped.set(key, { entity: otherEntity, relations: [] });
                }
                if (label) {
                    grouped.get(key).relations.push(label);
                }
            };

            this.links.forEach(link => {
                const fromId = String(link.from_entity.id);
                const toId = String(link.to_entity.id);

                if (fromId === targetId) {
                    addRelation(link.to_entity, link.title || 'Lien sortant');
                } else if (toId === targetId) {
                    addRelation(link.from_entity, link.title || 'Lien entrant');
                }
            });

            return Array.from(grouped.values());
        }

        renderMarkdown(text) {
            if (!text) {
                return '';
            }

            const escaped = this.escapeHtml(text).replace(/\r\n/g, '\n');
            const lines = escaped.split('\n');
            const htmlParts = [];
            let inList = false;

            const flushList = () => {
                if (inList) {
                    htmlParts.push('</ul>');
                    inList = false;
                }
            };

            lines.forEach(line => {
                const trimmed = line.trim();
                const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
                if (headingMatch) {
                    flushList();
                    const level = headingMatch[1].length;
                    const content = this.renderMarkdownInline(headingMatch[2]);
                    htmlParts.push(`<h${level} class="text-slate-100 text-base font-semibold">${content}</h${level}>`);
                    return;
                }

                if (/^[-*]\s+/.test(trimmed)) {
                    if (!inList) {
                        htmlParts.push('<ul class="list-disc list-inside space-y-1">');
                        inList = true;
                    }
                    const item = trimmed.replace(/^[-*]\s+/, '');
                    htmlParts.push(`<li>${this.renderMarkdownInline(item)}</li>`);
                    return;
                }

                if (trimmed === '') {
                    flushList();
                    htmlParts.push('<br>');
                    return;
                }

                flushList();
                htmlParts.push(`<p class="text-sm text-slate-200">${this.renderMarkdownInline(trimmed)}</p>`);
            });

            flushList();

            return htmlParts.join('\n');
        }

        renderMarkdownInline(text) {
            return text
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+?)`/g, '<code class="bg-slate-800 px-1 py-0.5 rounded text-xs text-blue-200">$1</code>');
        }

        escapeHtml(value) {
            if (value === null || value === undefined) {
                return '';
            }
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        openInvestigationSettingsModal() {
            if (!this.isOwner) return;
            const modal = document.getElementById('investigationSettingsModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            this.renderMemberAccessList();
            this.fetchPresence().catch(() => {});
        }

        closeInvestigationSettingsModal() {
            const modal = document.getElementById('investigationSettingsModal');
            if (!modal) return;
            modal.classList.add('hidden');
        }

        updateInvestigationCode(newCode) {
            if (!newCode) return;
            const codeBtn = document.getElementById('investigationCodeBtn');
            if (codeBtn) {
                if (codeBtn._copyTimeout) {
                    clearTimeout(codeBtn._copyTimeout);
                    codeBtn._copyTimeout = null;
                }
                const label = codeBtn.querySelector('[data-code-display]');
                if (label) {
                    label.textContent = newCode;
                }
                codeBtn.dataset.code = newCode;
                codeBtn.dataset.originalLabel = newCode;
                codeBtn.title = `Code : ${newCode}`;

                const icon = codeBtn.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-check');
                    if (!icon.classList.contains('fa-copy')) {
                        icon.classList.add('fa-copy');
                    }
                }

                codeBtn.classList.remove('text-emerald-300', 'border-emerald-500/60', 'bg-emerald-500/10');
                if (!codeBtn.classList.contains('text-blue-400')) {
                    codeBtn.classList.add('text-blue-400');
                }
                codeBtn.classList.add('hover:text-blue-300', 'border-blue-500/40');
            }

            const settingsCode = document.getElementById('investigationSettingsCode');
            if (settingsCode) {
                settingsCode.textContent = newCode;
            }
        }

        async revokeMember(userId, buttonEl) {
            if (!this.isOwner || !userId) return;

            const confirmation = window.confirm("Retirer l'accès à cette personne ?\nLe code de l'enquête sera régénéré.");
            if (!confirmation) {
                return;
            }

            let originalContent = '';
            if (buttonEl) {
                originalContent = buttonEl.innerHTML;
                buttonEl.disabled = true;
                buttonEl.innerHTML = '<span class="flex items-center gap-2"><i class="fas fa-spinner fa-spin"></i><span>Suppression...</span></span>';
            }

            try {
                const response = await fetch(`/api/investigation/${this.investigationId}/members/${userId}/revoke/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.csrfToken
                    },
                    body: JSON.stringify({})
                });

                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(payload.error || "Impossible de retirer ce membre");
                }

                if (payload.code) {
                    this.updateInvestigationCode(payload.code);
                }

                this.showNotification(payload.message || "Accès retiré", 'success');
                await this.fetchPresence();
            } catch (error) {
                console.error('Error revoking member:', error);
                this.showNotification(error.message || "Erreur lors du retrait d'accès", 'error');
            } finally {
                if (buttonEl) {
                    buttonEl.disabled = false;
                    buttonEl.innerHTML = originalContent || '<i class="fas fa-user-slash"></i><span>Retirer l\'accès</span>';
                }
            }
        }

        async deleteInvestigation() {
            if (!this.isOwner) return;

            const confirmDelete = window.confirm("Êtes-vous sûr de vouloir supprimer cette enquête ?\nCette action est irréversible.");
            if (!confirmDelete) return;

            const deleteBtn = document.getElementById('deleteInvestigationBtn');
            let originalContent = '';
            if (deleteBtn) {
                originalContent = deleteBtn.innerHTML;
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '<span class="flex items-center gap-2"><i class="fas fa-spinner fa-spin"></i><span>Suppression...</span></span>';
            }

            try {
                const response = await fetch(`/api/investigation/${this.investigationId}/delete/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.csrfToken
                    }
                });

                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(payload.error || "Impossible de supprimer l'enquête");
                }

                const redirectUrl = payload.redirect || '/dashboard/';
                window.location.href = redirectUrl;
            } catch (error) {
                console.error('Error deleting investigation:', error);
                this.showNotification(error.message || "Erreur lors de la suppression de l'enquête", 'error');
            } finally {
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = originalContent || '<i class="fas fa-trash mr-2"></i>Supprimer l\'enquête';
                }
            }
        }

        startPresence() {
            // Poll presence every 5 seconds
            this._presenceInterval = setInterval(() => this.fetchPresence(), 5000);
        }

        startHeartbeat() {
            // Send heartbeat every 10 seconds
            this._heartbeat = setInterval(async () => {
                try {
                    await fetch(`/api/investigation/${this.investigationId}/presence/heartbeat/`, { method: 'POST', headers: { 'X-CSRFToken': this.csrfToken } });
                } catch (e) {
                    // ignore
                }
            }, 10000);
            // send initial heartbeat
            fetch(`/api/investigation/${this.investigationId}/presence/heartbeat/`, { method: 'POST', headers: { 'X-CSRFToken': this.csrfToken } }).catch(() => {});
        }

        // Auto-sync polling to pick up changes from other users
        startAutoSync() {
            // Poll every 4 seconds for changes (adjust as needed)
            this._syncInterval = setInterval(() => this.fetchLatestChanges(), 4000);
            // do an initial poll shortly after load
            setTimeout(() => this.fetchLatestChanges(), 2000);
        }

        async fetchLatestChanges() {
            try {
                const [entitiesResponse, linksResponse] = await Promise.all([
                    fetch(`/api/investigation/${this.investigationId}/entities/`),
                    fetch(`/api/investigation/${this.investigationId}/links/`)
                ]);

                if (!entitiesResponse.ok || !linksResponse.ok) return;

                const newEntities = (await entitiesResponse.json()).entities || [];
                const newLinks = (await linksResponse.json()).links || [];

                let changed = false;

                // Quick length check
                if (newEntities.length !== this.entities.length) changed = true;

                // If same length, check updated_at for entities
                if (!changed) {
                    const oldMap = {};
                    this.entities.forEach(e => { oldMap[e.id] = e.updated_at || e.created_at; });
                    for (const ne of newEntities) {
                        if (!oldMap[ne.id] || oldMap[ne.id] !== ne.updated_at) {
                            changed = true; break;
                        }
                    }
                }

                // Links: check ids set or length change
                if (!changed) {
                    if (newLinks.length !== this.links.length) changed = true;
                    else {
                        const oldLinkIds = new Set(this.links.map(l => l.id));
                        for (const nl of newLinks) {
                            if (!oldLinkIds.has(nl.id)) { changed = true; break; }
                        }
                    }
                }

                if (changed) {
                    // Replace and refresh view
                    this.entities = newEntities;
                    this.links = newLinks;
                    this.linkCountMap = this.buildLinkCountMap();
                    this.refreshView();
                    this.refreshEntityDetail();
                    this.updateActiveFilterChips();
                }
            } catch (e) {
                console.error('Error fetching latest changes for auto-sync', e);
            }
        }

        toggleTypeFilter(type, forceState = null) {
            if (!type) return;
            const isActive = this.activeTypeFilters.has(type);
            const nextState = forceState === null ? !isActive : Boolean(forceState);

            if (nextState) {
                this.activeTypeFilters.add(type);
            } else {
                this.activeTypeFilters.delete(type);
            }

            this.updateTypeButtonAppearance(type, nextState);
            this.updateActiveFilterChips();
            this.refreshView();
        }

        updateTypeButtonAppearance(type, isActive) {
            const button = document.querySelector(`#filterTypeButtons [data-filter-type="${type}"]`);
            if (!button) return;

            button.classList.toggle('bg-blue-600', isActive);
            button.classList.toggle('text-white', isActive);
            button.classList.toggle('border-blue-500/60', isActive);
            button.classList.toggle('bg-slate-800/80', !isActive);
            button.classList.toggle('text-slate-300', !isActive);
            button.classList.toggle('border-slate-700', !isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        }

        resetTypeFilters(silent = false) {
            this.activeTypeFilters.clear();
            const types = ['person', 'location', 'evidence', 'event'];
            types.forEach(type => this.updateTypeButtonAppearance(type, false));

            if (!silent) {
                this.updateActiveFilterChips();
                this.refreshView();
            }
        }

        toggleAttributeFilter(key, isActive) {
            if (!(key in this.attributeFilters)) return;
            const flag = Boolean(isActive);
            this.attributeFilters[key] = flag;

            const checkboxMap = {
                has_description: 'filterHasDescription',
                has_links: 'filterHasLinks'
            };
            const checkboxId = checkboxMap[key];
            if (checkboxId) {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox && checkbox.checked !== flag) {
                    checkbox.checked = flag;
                }
            }

            this.updateActiveFilterChips();
            this.refreshView();
        }

        resetAttributeFilters(silent = false) {
            Object.keys(this.attributeFilters).forEach(key => {
                this.attributeFilters[key] = false;
            });

            ['filterHasDescription', 'filterHasLinks'].forEach(id => {
                const checkbox = document.getElementById(id);
                if (checkbox) {
                    checkbox.checked = false;
                }
            });

            if (!silent) {
                this.updateActiveFilterChips();
                this.refreshView();
            }
        }

        onSortChange(event) {
            const value = event?.target?.value || 'updated_desc';
            this.sortOption = value;
            this.refreshView();
        }

        onSearchInput(event) {
            const raw = event?.target?.value || '';
            this.searchTermRaw = raw;
            this.searchTerm = raw.toLowerCase();
            this.updateActiveFilterChips();
            this.refreshView();
        }

        updateActiveFilterChips() {
            const container = document.getElementById('activeFilterChips');
            if (!container) return;

            container.innerHTML = '';

            const typeLabels = {
                person: 'Personnes',
                location: 'Lieux',
                evidence: 'Preuves',
                event: 'Événements'
            };

            const attributeLabels = {
                has_description: 'Avec description',
                has_links: 'Avec liens'
            };

            const chips = [];

            this.activeTypeFilters.forEach(type => {
                chips.push({
                    key: `type:${type}`,
                    label: typeLabels[type] || type,
                    onRemove: () => this.toggleTypeFilter(type, false)
                });
            });

            Object.entries(this.attributeFilters).forEach(([key, value]) => {
                if (value) {
                    chips.push({
                        key: `attr:${key}`,
                        label: attributeLabels[key] || key,
                        onRemove: () => this.toggleAttributeFilter(key, false)
                    });
                }
            });

            if (this.searchTermRaw && this.searchTermRaw.trim()) {
                chips.push({
                    key: 'search',
                    label: `Recherche : "${this.searchTermRaw.trim()}"`,
                    onRemove: () => {
                        this.searchTermRaw = '';
                        this.searchTerm = '';
                        const input = document.getElementById('searchInput');
                        if (input) {
                            input.value = '';
                        }
                        this.updateActiveFilterChips();
                        this.refreshView();
                    }
                });
            }

            if (!chips.length) {
                container.classList.add('hidden');
                return;
            }

            container.classList.remove('hidden');

            chips.forEach(chip => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-200 text-xs border border-slate-600 hover:border-slate-400 transition-colors';
                button.innerHTML = `<span>${chip.label}</span><i class="fas fa-times text-[10px]"></i>`;
                button.addEventListener('click', () => chip.onRemove());
                container.appendChild(button);
            });
        }

        buildLinkCountMap() {
            const map = new Map();
            this.links.forEach(link => {
                const fromId = String(link.from_entity.id);
                const toId = String(link.to_entity.id);
                map.set(fromId, (map.get(fromId) || 0) + 1);
                map.set(toId, (map.get(toId) || 0) + 1);
            });
            return map;
        }

        entityHasLinks(entityId) {
            const key = String(entityId);
            return (this.linkCountMap.get(key) || 0) > 0;
        }

        sortEntities(entities) {
            const sorted = [...entities];
            const typeOrder = {
                person: 0,
                location: 1,
                event: 2,
                evidence: 3
            };

            const compareTitle = (a, b) => (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' });
            const getTimestamp = (value) => {
                if (!value) return 0;
                const date = new Date(value);
                return Number.isNaN(date.getTime()) ? 0 : date.getTime();
            };

            const getUpdatedTimestamp = (entity) => getTimestamp(entity.updated_at) || getTimestamp(entity.created_at);
            const getCreatedTimestamp = (entity) => getTimestamp(entity.created_at);
            const getLinkCount = (entity) => this.linkCountMap.get(String(entity.id)) || 0;

            switch (this.sortOption) {
                case 'updated_asc':
                    sorted.sort((a, b) => getUpdatedTimestamp(a) - getUpdatedTimestamp(b));
                    break;
                case 'created_desc':
                    sorted.sort((a, b) => getCreatedTimestamp(b) - getCreatedTimestamp(a));
                    break;
                case 'created_asc':
                    sorted.sort((a, b) => getCreatedTimestamp(a) - getCreatedTimestamp(b));
                    break;
                case 'title_asc':
                    sorted.sort((a, b) => compareTitle(a, b));
                    break;
                case 'title_desc':
                    sorted.sort((a, b) => compareTitle(b, a));
                    break;
                case 'type_asc':
                    sorted.sort((a, b) => {
                        const diff = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
                        return diff !== 0 ? diff : compareTitle(a, b);
                    });
                    break;
                case 'links_desc':
                    sorted.sort((a, b) => {
                        const diff = getLinkCount(b) - getLinkCount(a);
                        return diff !== 0 ? diff : compareTitle(a, b);
                    });
                    break;
                case 'updated_desc':
                default:
                    sorted.sort((a, b) => getUpdatedTimestamp(b) - getUpdatedTimestamp(a));
                    break;
            }

            return sorted;
        }

        switchView(view) {
            this.currentView = view;
            // Render the current view based on what's on the page
            switch(view) {
                case 'timeline':
                    if (document.getElementById('timelineView')) {
                        this.renderTimeline();
                    }
                    break;
                case 'network':
                    if (document.getElementById('networkView')) {
                        this.renderNetwork();
                    }
                    break;
                case 'cards':
                    if (document.getElementById('cardsView')) {
                        this.renderCards();
                    }
                    break;
            }
        }

        refreshView() {
            this.switchView(this.currentView);
        }

        getFilteredEntities() {
            const searchTerm = (this.searchTerm || '').trim();
            const normalizedSearch = searchTerm.toLowerCase();

            const personChecks = Array.from(document.querySelectorAll('#personsList input[type=checkbox]:checked')).map(i => i.value);
            const placeChecks = Array.from(document.querySelectorAll('#placesList input[type=checkbox]:checked')).map(i => i.value);
            const eventChecks = Array.from(document.querySelectorAll('#eventsList input[type=checkbox]:checked')).map(i => i.value);

            const forceTimelineEvent = (this.currentView === 'timeline');

            const selectedPersons = new Set(personChecks.map(String));
            const selectedPlaces = new Set(placeChecks.map(String));
            const selectedEvents = new Set(eventChecks.map(String));

            const focusIds = new Set([...selectedPersons, ...selectedPlaces]);

            let filtered = [...this.entities];

            if (focusIds.size > 0) {
                const linkedIds = new Set(focusIds);
                this.links.forEach(link => {
                    const fromId = String(link.from_entity.id);
                    const toId = String(link.to_entity.id);
                    if (focusIds.has(fromId) || focusIds.has(toId)) {
                        linkedIds.add(fromId);
                        linkedIds.add(toId);
                    }
                });

                filtered = filtered.filter(entity => linkedIds.has(String(entity.id)));
            }

            if (this.activeTypeFilters.size > 0) {
                filtered = filtered.filter(entity => this.activeTypeFilters.has(entity.type));
            }

            filtered = filtered.filter(entity => {
                const entityId = String(entity.id);
                if (forceTimelineEvent && entity.type !== 'event') return false;

                const linkedLocations = this.getLinkedLocations(entityId);

                if (selectedPlaces.size > 0) {
                    if (entity.type === 'location') {
                        if (!selectedPlaces.has(entityId)) {
                            return false;
                        }
                    } else if (!selectedPersons.has(entityId)) {
                        const linkedIds = linkedLocations.map(loc => String(loc.id));
                        if (!linkedIds.some(id => selectedPlaces.has(id))) {
                            return false;
                        }
                    }
                }

                if (selectedEvents.size > 0 && entity.type === 'event' && !selectedEvents.has(entityId)) {
                    return false;
                }

                if (this.attributeFilters.has_description) {
                    if (!(entity.description && entity.description.trim().length > 0)) {
                        return false;
                    }
                }

                if (this.attributeFilters.has_links && !this.entityHasLinks(entityId)) {
                    return false;
                }

                if (searchTerm) {
                    const searchPool = [
                        entity.title || '',
                        entity.description || '',
                        entity.location || '',
                        entity.event_end_date || '',
                        entity.address || '',
                        entity.role || '',
                        ...linkedLocations.map(loc => `${loc.title} ${loc.address || ''}`)
                    ].join(' ').toLowerCase();
                    if (!searchPool.includes(normalizedSearch)) {
                        return false;
                    }
                }

                return true;
            });

            return this.sortEntities(filtered);
        }

        getLinkedLocations(entityId) {
            const targetId = String(entityId);
            const seen = new Set();
            const locations = [];

            this.links.forEach(link => {
                const fromId = String(link.from_entity.id);
                const toId = String(link.to_entity.id);

                if (fromId === targetId && link.to_entity.type === 'location') {
                    if (!seen.has(link.to_entity.id)) {
                        seen.add(link.to_entity.id);
                        locations.push(link.to_entity);
                    }
                }

                if (toId === targetId && link.from_entity.type === 'location') {
                    if (!seen.has(link.from_entity.id)) {
                        seen.add(link.from_entity.id);
                        locations.push(link.from_entity);
                    }
                }
            });

            return locations;
        }

        renderTimeline() {
            const calendar = document.getElementById('timelineContainer');
            const axisEl = document.getElementById('timelineAxis');
            const eventsLayer = document.getElementById('timelineEvents');
            const inner = document.getElementById('timelineCalendarInner');
            const emptyState = document.getElementById('timelineEmptyState');

            if (!calendar || !axisEl || !eventsLayer || !inner || !emptyState) {
                return;
            }

            const MS_IN_MINUTE = 60000;
            const MS_IN_HOUR = 60 * MS_IN_MINUTE;
            const POINT_DURATION_MS = 45 * MS_IN_MINUTE;
            const POINT_EVENT_MIN_WIDTH = 160;

            const parseDate = (value) => {
                if (!value) return null;
                const parsed = new Date(value);
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            };

            const filteredEntities = this.getFilteredEntities();
            const normalizedEvents = filteredEntities
                .filter(entity => entity.type === 'event' && entity.event_date)
                .map(entity => {
                    const start = parseDate(entity.event_date);
                    if (!start) return null;

                    let end = parseDate(entity.event_end_date);
                    const hasDuration = Boolean(end && end > start);
                    if (!hasDuration) {
                        end = null;
                    }

                    const visualEnd = hasDuration ? end : new Date(start.getTime() + POINT_DURATION_MS);

                    return {
                        raw: entity,
                        start,
                        end,
                        visualEnd,
                        hasDuration
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.start - b.start);

            if (normalizedEvents.length === 0) {
                axisEl.innerHTML = '';
                eventsLayer.innerHTML = '';
                inner.style.width = '100%';
                axisEl.style.width = '100%';
                eventsLayer.style.width = '100%';
                calendar.classList.add('hidden');
                emptyState.classList.remove('hidden');
                return;
            }

            emptyState.classList.add('hidden');
            calendar.classList.remove('hidden');

            let minStart = normalizedEvents[0].start;
            let maxEnd = normalizedEvents[0].visualEnd;

            normalizedEvents.forEach(evt => {
                if (evt.start < minStart) minStart = evt.start;
                if (evt.visualEnd > maxEnd) maxEnd = evt.visualEnd;
            });

            const minStartMs = minStart.getTime();
            const maxEndMs = maxEnd.getTime();
            const totalDurationMs = Math.max(maxEndMs - minStartMs, MS_IN_HOUR);
            const totalHours = totalDurationMs / MS_IN_HOUR;
            const pxPerHour = totalHours <= 6 ? 220 : totalHours <= 12 ? 180 : totalHours <= 24 ? 140 : totalHours <= 24 * 7 ? 60 : totalHours <= 24 * 30 ? 34 : 20;
            const minWidth = Math.max(calendar.clientWidth || 800, 600);
            const maxWidth = Math.max(12000, minWidth * 4);
            const rawWidth = totalHours * pxPerHour;
            const timelineWidth = Math.min(Math.max(rawWidth, minWidth), maxWidth);

            inner.style.width = `${timelineWidth}px`;
            axisEl.style.width = `${timelineWidth}px`;
            eventsLayer.style.width = `${timelineWidth}px`;

            axisEl.innerHTML = '';
            eventsLayer.innerHTML = '';

            const selectTickDefinition = (hoursSpan) => {
                if (hoursSpan <= 6) {
                    return { stepMinutes: 30, labelOptions: { hour: '2-digit', minute: '2-digit' }, isMajor: date => date.getHours() % 2 === 0 && date.getMinutes() === 0 };
                }
                if (hoursSpan <= 12) {
                    return { stepMinutes: 60, labelOptions: { hour: '2-digit', minute: '2-digit' }, isMajor: date => date.getHours() % 3 === 0 };
                }
                if (hoursSpan <= 48) {
                    return { stepMinutes: 180, labelOptions: { weekday: 'short', hour: '2-digit' }, isMajor: date => date.getHours() === 0 };
                }
                if (hoursSpan <= 24 * 7) {
                    return { stepMinutes: 720, labelOptions: { weekday: 'short', day: 'numeric', hour: '2-digit' }, isMajor: date => date.getHours() === 0 };
                }
                if (hoursSpan <= 24 * 30) {
                    return { stepMinutes: 1440, labelOptions: { weekday: 'short', day: 'numeric' }, isMajor: date => date.getDay() === 1 };
                }
                if (hoursSpan <= 24 * 180) {
                    return { stepMinutes: 10080, labelOptions: { day: 'numeric', month: 'short' }, isMajor: date => date.getDate() <= 7 };
                }
                if (hoursSpan <= 24 * 365 * 2) {
                    return { stepMinutes: 43200, labelOptions: { month: 'short', year: 'numeric' }, isMajor: date => date.getMonth() === 0 };
                }
                return { stepMinutes: 525600, labelOptions: { year: 'numeric' }, isMajor: date => date.getFullYear() % 5 === 0 };
            };

            const tickDef = selectTickDefinition(totalHours);
            const stepMs = tickDef.stepMinutes * MS_IN_MINUTE;
            const tickFormatter = new Intl.DateTimeFormat('fr-FR', tickDef.labelOptions);

            const tickSet = new Set([minStartMs, maxEndMs]);
            let currentMs = Math.floor(minStartMs / stepMs) * stepMs;
            if (currentMs < minStartMs) currentMs += stepMs;

            while (currentMs <= maxEndMs) {
                tickSet.add(currentMs);
                currentMs += stepMs;
            }

            const tickTimes = Array.from(tickSet).sort((a, b) => a - b);
            const axisFragment = document.createDocumentFragment();
            const gridFragment = document.createDocumentFragment();

            tickTimes.forEach(tickMs => {
                const ratio = (tickMs - minStartMs) / totalDurationMs;
                const position = Math.min(Math.max(ratio * timelineWidth, 0), timelineWidth);
                const date = new Date(tickMs);

                const tick = document.createElement('div');
                tick.className = 'timeline-axis-tick';
                if (tickDef.isMajor(date)) {
                    tick.classList.add('major');
                }
                tick.style.left = `${position}px`;
                axisFragment.appendChild(tick);

                const label = document.createElement('div');
                label.className = 'timeline-axis-label';
                label.style.left = `${position}px`;
                label.textContent = tickFormatter.format(date);
                axisFragment.appendChild(label);

                const grid = document.createElement('div');
                grid.className = 'timeline-gridline';
                grid.style.left = `${position}px`;
                gridFragment.appendChild(grid);
            });

            axisEl.appendChild(axisFragment);
            eventsLayer.appendChild(gridFragment);

            const includeDateInLabel = totalDurationMs > 12 * MS_IN_HOUR;
            const dateFormatter = includeDateInLabel ? new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : null;
            const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const fullDateFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

            const formatMoment = (date) => {
                if (!date) return '';
                const timePart = timeFormatter.format(date);
                if (!includeDateInLabel || !dateFormatter) {
                    return timePart;
                }
                return `${dateFormatter.format(date)} · ${timePart}`;
            };

            const formatMomentWithFallback = (date, isDateOnly) => {
                if (!date) return '';
                if (isDateOnly) {
                    return fullDateFormatter.format(date);
                }
                return formatMoment(date);
            };

            const lanes = [];
            const eventsFragment = document.createDocumentFragment();
            const laneHeight = 92;

            normalizedEvents.forEach(evt => {
                const startMs = evt.start.getTime();
                const visualEndMs = evt.visualEnd.getTime();
                const endMs = evt.end ? evt.end.getTime() : visualEndMs;
                const ratioStart = (startMs - minStartMs) / totalDurationMs;
                const rawWidthRatio = (visualEndMs - startMs) / totalDurationMs;
                const linkedLocations = this.getLinkedLocations(evt.raw.id);

                let laneIndex = lanes.findIndex(laneEnd => startMs >= laneEnd);
                if (laneIndex === -1) {
                    lanes.push(visualEndMs);
                    laneIndex = lanes.length - 1;
                } else {
                    lanes[laneIndex] = visualEndMs;
                }

                let width;
                if (evt.hasDuration) {
                    width = Math.max(rawWidthRatio * timelineWidth, 24);
                } else {
                    width = POINT_EVENT_MIN_WIDTH;
                }

                const left = Math.max(ratioStart * timelineWidth, 0);
                width = Math.min(width, Math.max(timelineWidth - left, 0));
                width = Math.max(width, 12);

                let blockLeft = left;
                if (blockLeft + width > timelineWidth) {
                    blockLeft = Math.max(timelineWidth - width, 0);
                }

                const eventBlock = document.createElement('div');
                eventBlock.className = 'timeline-event';
                if (evt.raw.is_timeslot) {
                    eventBlock.classList.add('timeslot');
                }
                if (!evt.hasDuration) {
                    eventBlock.classList.add('point');
                }

                const rawStartDate = evt.raw.event_date || '';
                const rawEndDate = evt.raw.event_end_date || '';
                const isDateOnlyStart = Boolean(rawStartDate && !rawStartDate.includes('T') && !rawStartDate.includes(':'));
                const isDateOnlyEnd = Boolean(rawEndDate && !rawEndDate.includes('T') && !rawEndDate.includes(':'));

                const startLabel = formatMomentWithFallback(evt.start, isDateOnlyStart);
                const endLabel = evt.hasDuration ? formatMomentWithFallback(new Date(endMs), isDateOnlyEnd) : '';
                const timeLabel = evt.hasDuration ? `${startLabel} → ${endLabel}` : startLabel;

                const locationNames = linkedLocations.map(loc => loc.title).filter(Boolean);
                const metaSegments = [];

                if (evt.raw.is_timeslot) {
                    metaSegments.push('<span>Créneau approximatif</span>');
                }
                if (!evt.hasDuration && isDateOnlyStart) {
                    metaSegments.push('<span>Heure non précisée</span>');
                }
                if (locationNames.length) {
                    metaSegments.push(`<span><i class="fas fa-map-marker-alt mr-1"></i>${locationNames.join(', ')}</span>`);
                }

                const tooltipParts = [evt.raw.title || 'Événement'];
                if (locationNames.length) {
                    tooltipParts.push(locationNames.join(', '));
                }
                tooltipParts.push(timeLabel);

                eventBlock.dataset.title = tooltipParts.filter(Boolean).join(' • ');
                eventBlock.dataset.eventId = evt.raw.id;
                eventBlock.style.left = `${blockLeft}px`;
                eventBlock.style.top = `${laneIndex * laneHeight}px`;
                eventBlock.style.width = `${Math.max(width, 4)}px`;
                eventBlock.setAttribute('tabindex', '0');
                eventBlock.title = timeLabel;

                const descriptionMarkup = evt.raw.description
                    ? `<p class="text-xs text-slate-100/80 leading-snug overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${evt.raw.description}</p>`
                    : '';

                eventBlock.innerHTML = `
                    <div class="timeline-event-content">
                        <div class="timeline-event-title">${evt.raw.title || 'Sans titre'}</div>
                        <div class="timeline-event-time">${timeLabel}</div>
                        ${metaSegments.length ? `<div class="timeline-event-meta">${metaSegments.join('<span class="opacity-60">•</span>')}</div>` : ''}
                        ${descriptionMarkup}
                    </div>
                `;

                eventBlock.addEventListener('click', () => {
                    this.openEntityDetail(evt.raw.id);
                });

                eventBlock.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.openEntityDetail(evt.raw.id);
                    }
                });

                eventsFragment.appendChild(eventBlock);
            });

            eventsLayer.appendChild(eventsFragment);
            eventsLayer.style.height = `${Math.max(lanes.length, 1) * laneHeight}px`;
        }

        renderNetwork() {
            if (!this.networkChart) {
                this.networkChart = echarts.init(document.getElementById('networkChart'));
            }

            const filteredEntities = this.getFilteredEntities();

            if (filteredEntities.length === 0) {
                this.networkChart.setOption({
                    title: {
                        text: 'Aucune donnée à afficher',
                        left: 'center',
                        top: 'middle',
                        textStyle: {
                            color: '#94a3b8',
                            fontSize: 18
                        }
                    }
                });
                return;
            }

            const nodes = [];
            const links = [];
            const nodeIds = new Set();

            // Create nodes
            filteredEntities.forEach(entity => {
                const nodeId = entity.id;
                let symbolSize = 30;
                let color = '#60a5fa';

                switch(entity.type) {
                    case 'person':
                        color = '#34d399';
                        symbolSize = 40;
                        break;
                    case 'location':
                        color = '#f97316';
                        symbolSize = 38;
                        break;
                    case 'evidence':
                        color = '#fbbf24';
                        symbolSize = 35;
                        break;
                    case 'event':
                        color = '#a78bfa';
                        symbolSize = 45;
                        break;
                }

                nodes.push({
                    id: nodeId,
                    name: entity.title,
                    category: entity.type,
                    symbolSize: symbolSize,
                    itemStyle: {
                        color: color
                    }
                });

                nodeIds.add(nodeId);
            });

            // Create links from our links data
            this.links.forEach(link => {
                if (nodeIds.has(link.from_entity.id) && nodeIds.has(link.to_entity.id)) {
                    links.push({
                        source: link.from_entity.id,
                        target: link.to_entity.id,
                        name: link.title,
                        lineStyle: {
                            color: '#60a5fa',
                            opacity: 0.6,
                            width: 2
                        }
                    });
                }
            });

            const nodeCount = filteredEntities.length;
            const repulsion = Math.min(480, 140 + nodeCount * 22);
            const edgeLength = Math.min(260, 160 + Math.max(0, nodeCount - 4) * 6);

            const option = {
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'item',
                    formatter: function(params) {
                        if (params.dataType === 'node') {
                            return `<strong>${params.data.name}</strong><br/>Type: ${params.data.category}`;
                        } else {
                            return `Lien: ${params.data.name}`;
                        }
                    },
                    backgroundColor: '#1e293b',
                    borderColor: '#475569',
                    textStyle: {
                        color: '#e2e8f0'
                    }
                },
                legend: {
                    data: ['person', 'location', 'evidence', 'event'],
                    orient: 'vertical',
                    left: 'left',
                    top: 'top',
                    textStyle: {
                        color: '#94a3b8'
                    }
                },
                series: [{
                    type: 'graph',
                    layout: 'force',
                    zoom: 1.18,
                    center: ['50%', '50%'],
                    cursor: 'pointer',
                    data: nodes,
                    links: links,
                    categories: [
                        { name: 'person', itemStyle: { color: '#34d399' } },
                        { name: 'location', itemStyle: { color: '#f97316' } },
                        { name: 'evidence', itemStyle: { color: '#fbbf24' } },
                        { name: 'event', itemStyle: { color: '#a78bfa' } }
                    ],
                    roam: true,
                    force: {
                        repulsion: repulsion,
                        gravity: 0.08,
                        edgeLength: edgeLength,
                        layoutAnimation: true
                    },
                    label: {
                        show: true,
                        position: 'bottom',
                        formatter: '{b}',
                        color: '#e2e8f0',
                        fontSize: 12
                    },
                    emphasis: {
                        focus: 'adjacency',
                        lineStyle: {
                            width: 4
                        }
                    }
                }]
            };


                this.networkChart.off('click');
                this.networkChart.on('click', (params) => {
                    if (params && params.dataType === 'node' && params.data) {
                        const nodeId = params.data.id ?? params.data.value ?? params.name;
                        if (nodeId !== undefined && nodeId !== null) {
                            this.openEntityDetail(nodeId);
                        }
                    }
                });
            this.networkChart.setOption(option);
        }

        renderCards() {
            const container = document.getElementById('cardsContainer');
            const filteredEntities = this.getFilteredEntities();

            if (filteredEntities.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-12">
                        <i class="fas fa-inbox text-4xl text-slate-600 mb-4"></i>
                        <p class="text-slate-400">Aucun élément à afficher</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = filteredEntities.map(entity => {
                let icon = '';
                let color = '';
                let content = '';

                switch(entity.type) {
                    case 'person':
                        icon = 'fas fa-user';
                        color = 'green';
                        content = `
                            <h3 class="text-xl font-bold text-white mb-2">${entity.title}</h3>
                            ${entity.role ? `<p class="text-green-400 text-sm mb-2">${entity.role}</p>` : ''}
                            ${entity.description ? `<p class="text-slate-300 text-sm mb-4">${entity.description}</p>` : ''}
                        `;
                        break;
                    case 'location':
                        icon = 'fas fa-map-marker-alt';
                        color = 'amber';
                        content = `
                            <h3 class="text-xl font-bold text-white mb-2">${entity.title}</h3>
                            ${entity.location ? `<p class="text-amber-400 text-sm mb-2"><i class="fas fa-map-pin mr-1"></i>${entity.location}</p>` : ''}
                            ${entity.address ? `<p class="text-slate-400 text-sm mb-2">${entity.address}</p>` : ''}
                            ${entity.description ? `<p class="text-slate-300 text-sm mb-4">${entity.description}</p>` : ''}
                        `;
                        break;
                    case 'evidence':
                        icon = 'fas fa-file-alt';
                        color = 'yellow';
                        content = `
                            <h3 class="text-xl font-bold text-white mb-2">${entity.title}</h3>
                            ${entity.evidence_type ? `<p class="text-yellow-400 text-sm mb-2">${entity.evidence_type}</p>` : ''}
                            ${entity.description ? `<p class="text-slate-300 text-sm mb-4">${entity.description}</p>` : ''}
                        `;
                        break;
                    case 'event': {
                        icon = 'fas fa-calendar';
                        color = 'purple';
                        const eventLocations = this.getLinkedLocations(entity.id);
                        const locationChips = eventLocations.length ? `
                            <div class="flex flex-wrap gap-2 mb-2">
                                ${eventLocations.map(loc => `
                                    <span class="inline-flex items-center px-2 py-1 bg-amber-600/20 text-amber-300 text-xs rounded-full">
                                        <i class="fas fa-map-marker-alt mr-1"></i>${loc.title}
                                    </span>
                                `).join('')}
                            </div>
                        ` : '';
                        const startDate = entity.event_date ? new Date(entity.event_date) : null;
                        const endDate = entity.event_end_date ? new Date(entity.event_end_date) : null;
                        const hasDuration = Boolean(startDate && endDate);
                        const formatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                        const startLabel = startDate ? startDate.toLocaleString('fr-FR', formatOptions) : null;
                        const endLabel = endDate ? endDate.toLocaleString('fr-FR', formatOptions) : null;
                        const dateMarkup = startLabel ? (
                            hasDuration
                                ? `<p class="text-purple-300 text-sm mb-2">Du ${startLabel}<br><span class="text-purple-200">au ${endLabel}</span></p>`
                                : `<p class="text-purple-300 text-sm mb-2">${entity.is_timeslot ? 'Créneau le' : 'Le'} ${startLabel}</p>`
                        ) : '<p class="text-purple-300 text-sm mb-2">Date non précisée</p>';
                        const metaTags = [
                            hasDuration ? '<span class="px-2 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-200">Durée</span>' : '',
                            entity.is_timeslot ? '<span class="px-2 py-1 text-xs rounded-full bg-sky-500/20 text-sky-200">Créneau approximatif</span>' : ''
                        ].filter(Boolean);
                        const metaMarkup = metaTags.length ? `<div class="flex flex-wrap gap-2 mb-2">${metaTags.join('')}</div>` : '';
                        content = `
                            <h3 class="text-xl font-bold text-white mb-2">${entity.title}</h3>
                            ${dateMarkup}
                            ${metaMarkup}
                            ${locationChips}
                            ${entity.description ? `<p class="text-slate-300 text-sm mb-4">${entity.description}</p>` : ''}
                        `;
                        break;
                    }
                }

                return `
                    <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-${color}-500 transition-all duration-300 transform hover:scale-105 cursor-pointer focus-within:ring-2 focus-within:ring-${color}-500/60"
                         role="button"
                         tabindex="0"
                         onclick="app.openEntityDetail('${entity.id}')"
                         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();app.openEntityDetail('${entity.id}');}">
                        <div class="flex items-start justify-between mb-4">
                            <div class="w-12 h-12 bg-${color}-600 rounded-lg flex items-center justify-center">
                                <i class="${icon} text-white text-xl"></i>
                            </div>
                            <div class="flex space-x-2">
                                <button onclick="event.stopPropagation(); app.editEntity('${entity.id}')"
                                        class="p-2 text-blue-400 hover:text-blue-300 transition-colors">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        </div>

                        ${content}

                        <div class="mt-4 pt-4 border-t border-slate-700">
                            <p class="text-xs text-slate-500">
                                Créé le ${new Date(entity.created_at).toLocaleDateString('fr-FR')}
                            </p>
                        </div>
                    </div>
                `;
            }).join('');

            // Animate cards
            if (typeof anime === 'function') {
                anime({
                    targets: '#cardsContainer > div',
                    translateY: [50, 0],
                    opacity: [0, 1],
                    delay: anime.stagger(100),
                    duration: 600,
                    easing: 'easeOutExpo'
                });
            }
        }

        buildEntityFormFields(mode, type, entity = {}) {
            const isEdit = mode === 'edit';
            const data = entity || {};
            const safeTitle = this.escapeHtml(data.title || '');
            const safeRole = this.escapeHtml(data.role || '');
            const safeDescription = this.escapeHtml(data.description || '');
            const safeLocation = this.escapeHtml(data.location || '');
            const safeAddress = this.escapeHtml(data.address || '');
            const safeEvidenceType = this.escapeHtml(data.evidence_type || 'document');
            const eventDateValue = isEdit ? this.formatDateTimeForInput(data.event_date) : '';
            const eventEndDateValue = isEdit ? this.formatDateTimeForInput(data.event_end_date) : '';

            switch (type) {
                case 'person':
                    return `
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Nom</label>
                                <input type="text" name="title" value="${safeTitle}" required
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Rôle</label>
                                <input type="text" name="role" value="${safeRole}"
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Description</label>
                                <textarea name="description" rows="3"
                                          class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">${safeDescription}</textarea>
                            </div>
                        </div>
                    `;
                case 'location':
                    return `
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Nom du lieu</label>
                                <input type="text" name="title" value="${safeTitle}" required
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Zone / Ville</label>
                                <input type="text" name="location" value="${safeLocation}"
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Adresse</label>
                                <input type="text" name="address" value="${safeAddress}"
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Description</label>
                                <textarea name="description" rows="3"
                                          class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">${safeDescription}</textarea>
                            </div>
                        </div>
                    `;
                case 'evidence':
                    return `
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Titre</label>
                                <input type="text" name="title" value="${safeTitle}" required
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Type</label>
                                <select name="evidence_type"
                                        class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                                    <option value="document" ${safeEvidenceType === 'document' ? 'selected' : ''}>Document</option>
                                    <option value="photo" ${safeEvidenceType === 'photo' ? 'selected' : ''}>Photo</option>
                                    <option value="video" ${safeEvidenceType === 'video' ? 'selected' : ''}>Vidéo</option>
                                    <option value="audio" ${safeEvidenceType === 'audio' ? 'selected' : ''}>Audio</option>
                                    <option value="other" ${safeEvidenceType === 'other' ? 'selected' : ''}>Autre</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Description</label>
                                <textarea name="description" rows="3"
                                          class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">${safeDescription}</textarea>
                            </div>
                        </div>
                    `;
                case 'event':
                    return `
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Titre</label>
                                <input type="text" name="title" value="${safeTitle}" required
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Début</label>
                                <input type="datetime-local" name="event_date" value="${eventDateValue}" required
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Fin (optionnel)</label>
                                <input type="datetime-local" name="event_end_date" value="${eventEndDateValue}"
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Description</label>
                                <textarea name="description" rows="3"
                                          class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">${safeDescription}</textarea>
                            </div>
                            <label class="flex items-center space-x-3 text-sm text-slate-300">
                                <input type="checkbox" name="is_timeslot" ${data.is_timeslot ? 'checked' : ''} class="h-4 w-4 text-blue-500 border border-slate-500 rounded">
                                <span>Cet événement est un créneau approximatif</span>
                            </label>
                            <p class="text-xs text-slate-400">Associez ensuite un lieu via le bouton « Lien ».</p>
                        </div>
                    `;
                default:
                    return '';
            }
        }

        openCreateEntityForm(type) {
            this.currentFormMode = 'create';
            this.currentFormType = type;
            this.editingEntity = null;
            this.newEntityTags = [];

            const modal = document.getElementById('entityFormModal');
            const titleEl = document.getElementById('entityFormTitle');
            const fieldsContainer = document.getElementById('entityFormFields');
            const submitButton = document.getElementById('entityFormSubmitButton');
            const deleteButton = document.getElementById('entityFormDeleteButton');

            if (!modal || !titleEl || !fieldsContainer || !submitButton) {
                console.warn('Entity form structure missing');
                return;
            }

            const baseFields = this.buildEntityFormFields('create', type);
            const photoSection = this.buildPhotoSection('create');
            const tagSection = this.buildTagInputSection('create');
            const linksSection = this.buildNewEntityLinkSection();

            fieldsContainer.innerHTML = baseFields + photoSection + tagSection + linksSection;

            this.resetNewEntityLinkRows();
            this.attachPhotoInputHandlers('create');
            this.attachTagInputHandlers('create');

            titleEl.textContent = this.getCreateModalTitle(type);
            submitButton.textContent = 'Ajouter';
            submitButton.disabled = false;

            if (deleteButton) {
                deleteButton.classList.add('hidden');
            }

            modal.classList.remove('hidden');
        }

        getCreateModalTitle(type) {
            const labels = {
                person: 'Ajouter une personne',
                location: 'Ajouter un lieu',
                evidence: 'Ajouter une preuve',
                event: 'Ajouter un événement'
            };
            return labels[type] || 'Ajouter un élément';
        }

        getEditModalTitle(type) {
            const labels = {
                person: 'Modifier la personne',
                location: 'Modifier le lieu',
                evidence: 'Modifier la preuve',
                event: 'Modifier l\'événement'
            };
            return labels[type] || 'Modifier l\'élément';
        }

        openEditEntityForm(entityId) {
            const entity = this.entities.find(e => String(e.id) === String(entityId));
            if (!entity) {
                this.showNotification('Élément introuvable', 'error');
                return;
            }

            this.currentFormMode = 'edit';
            this.currentFormType = entity.type;
            this.editingEntity = entity;
            this.editingEntityTags = this.convertEntityTagsToState(entity.tags);

            const modal = document.getElementById('entityFormModal');
            const titleEl = document.getElementById('entityFormTitle');
            const fieldsContainer = document.getElementById('entityFormFields');
            const submitButton = document.getElementById('entityFormSubmitButton');
            const deleteButton = document.getElementById('entityFormDeleteButton');

            if (!modal || !titleEl || !fieldsContainer || !submitButton) {
                console.warn('Entity form structure missing');
                return;
            }

            const baseFields = this.buildEntityFormFields('edit', entity.type, entity);
            const photoSection = this.buildPhotoSection('edit', entity.photo_url || '');
            const tagSection = this.buildTagInputSection('edit');

            fieldsContainer.innerHTML = baseFields + photoSection + tagSection;

            this.attachPhotoInputHandlers('edit', entity.photo_url || '');
            this.attachTagInputHandlers('edit');

            titleEl.textContent = this.getEditModalTitle(entity.type);
            submitButton.textContent = 'Mettre à jour';
            submitButton.disabled = false;

            if (deleteButton) {
                deleteButton.classList.remove('hidden');
            }

            modal.classList.remove('hidden');
        }

        closeEntityFormModal() {
            const modal = document.getElementById('entityFormModal');
            const form = document.getElementById('entityForm');

            if (modal) {
                modal.classList.add('hidden');
            }

            if (form) {
                form.reset();
            }

            this.currentFormMode = null;
            this.currentFormType = null;
            this.editingEntity = null;
            this.newEntityTags = [];
            this.editingEntityTags = [];
            this.resetNewEntityLinkRows();
        }

        buildNewEntityLinkSection() {
            const entitiesAvailable = Array.isArray(this.entities) && this.entities.length > 0;
            if (!entitiesAvailable) {
                return `
                    <div class="mt-8 space-y-2 bg-slate-900/40 border border-slate-800 rounded-lg p-4">
                        <div class="flex items-center gap-2 text-sm font-semibold text-slate-200">
                            <i class="fas fa-link"></i>
                            <span>Liens</span>
                        </div>
                        <p class="text-xs text-slate-400">
                            Ajoutez d'autres éléments à l'enquête pour pouvoir créer des liens lors de l'ajout.
                        </p>
                    </div>
                `;
            }

            return `
                <div class="mt-8 space-y-3" id="newEntityLinksSection">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 text-sm font-semibold text-slate-200">
                            <i class="fas fa-link"></i>
                            <span>Liens à créer</span>
                        </div>
                        <button type="button"
                                class="text-xs px-3 py-1 rounded-full bg-slate-800 border border-slate-600 hover:border-slate-400 text-slate-200 transition-colors"
                                onclick="app.addNewEntityLinkRow()">
                            <i class="fas fa-plus mr-1"></i>Ajouter un lien
                        </button>
                    </div>
                    <p class="text-xs text-slate-400">
                        Les liens seront créés automatiquement après enregistrement de l'élément.
                    </p>
                    <div id="newEntityLinksContainer" class="space-y-3"></div>
                </div>
            `;
        }

        resetNewEntityLinkRows() {
            const container = document.getElementById('newEntityLinksContainer');
            if (container) {
                container.innerHTML = '';
            }
        }

        buildTagInputSection(mode = 'create') {
            const prefix = mode === 'edit' ? 'edit' : 'create';
            return `
                <div class="mt-8 space-y-3" id="${prefix}TagSection">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 text-sm font-semibold text-slate-200">
                            <i class="fas fa-tags"></i>
                            <span>Tags</span>
                        </div>
                        <button type="button"
                                class="text-xs px-3 py-1 rounded-full bg-slate-800 border border-slate-600 hover:border-slate-400 text-slate-200 transition-colors"
                                data-tag-clear="${prefix}">
                            Effacer
                        </button>
                    </div>
                    <div class="space-y-2">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2">
                            <input type="text"
                                   id="${prefix}TagInput"
                                   placeholder="Ajouter un tag et appuyer sur Entrée"
                                   class="flex-1 px-4 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm text-slate-200">
                            <button type="button"
                                    class="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs sm:text-sm hover:bg-blue-500 transition-colors"
                                    data-tag-add="${prefix}">
                                Ajouter
                            </button>
                        </div>
                        <p class="text-xs text-slate-500">Les tags aident à filtrer rapidement des éléments similaires.</p>
                    </div>
                    <div>
                        <h5 class="text-xs uppercase tracking-wide text-slate-400 mb-2">Sélectionnés</h5>
                        <div id="${prefix}TagChips" class="flex flex-wrap gap-2"></div>
                    </div>
                    <div>
                        <h5 class="text-xs uppercase tracking-wide text-slate-400 mb-2">Suggestions</h5>
                        <div id="${prefix}TagSuggestions" class="flex flex-wrap gap-2"></div>
                    </div>
                </div>
            `;
        }

        buildPhotoSection(mode = 'create', existingPhotoUrl = '') {
            const prefix = mode === 'edit' ? 'edit' : 'create';
            const safeUrl = existingPhotoUrl ? this.escapeHtml(existingPhotoUrl) : '';
            const hasPhoto = Boolean(safeUrl);
            return `
                <div class="mt-8 space-y-3" id="${prefix}PhotoSection">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 text-sm font-semibold text-slate-200">
                            <i class="fas fa-camera"></i>
                            <span>Photo</span>
                        </div>
                        ${mode === 'edit' ? `
                            <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                                <input type="checkbox" id="${prefix}RemovePhoto" class="rounded border-slate-600 text-blue-500 focus:ring-blue-400">
                                <span>Supprimer la photo existante</span>
                            </label>
                        ` : ''}
                    </div>
                    <div class="relative rounded-xl border border-dashed border-slate-600 bg-slate-900/60 p-4" data-photo-wrapper="${prefix}">
                        <div class="flex flex-col sm:flex-row gap-4">
                            <div class="relative flex-shrink-0 w-full sm:w-36">
                                <div class="aspect-square rounded-lg overflow-hidden bg-slate-800 flex items-center justify-center text-slate-500 text-sm" data-photo-preview="${prefix}" ${hasPhoto ? `style="background-image: url('${safeUrl}'); background-size: cover; background-position: center;"` : ''}>
                                    ${hasPhoto ? '' : '<span>Aucune image</span>'}
                                </div>
                                <button type="button" class="absolute bottom-2 right-2 px-2 py-1 text-xs bg-slate-900/80 border border-slate-700 rounded-md text-slate-200 hover:border-blue-500 transition-colors hidden" data-photo-remove="${prefix}">
                                    Retirer
                                </button>
                            </div>
                            <div class="flex-1 space-y-3">
                                <input type="file" id="${prefix}PhotoInput" accept="image/*" class="hidden" data-photo-input="${prefix}">
                                <div class="flex flex-wrap gap-2">
                                    <label for="${prefix}PhotoInput" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm cursor-pointer">
                                        <i class="fas fa-upload"></i>
                                        <span>Choisir une image</span>
                                    </label>
                                    <button type="button" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors" data-photo-reset="${prefix}">
                                        <i class="fas fa-undo"></i>
                                        <span>Réinitialiser</span>
                                    </button>
                                </div>
                                <p class="text-xs text-slate-500">
                                    Formats acceptés : JPG, PNG, WebP. Utilisez une image carrée pour un meilleur rendu.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        attachPhotoInputHandlers(mode = 'create', existingPhotoUrl = '') {
            const prefix = mode === 'edit' ? 'edit' : 'create';
            const wrapper = document.querySelector(`[data-photo-wrapper="${prefix}"]`);
            if (!wrapper) return;

            const input = wrapper.querySelector(`[data-photo-input="${prefix}"]`);
            const preview = wrapper.querySelector(`[data-photo-preview="${prefix}"]`);
            const removeBtn = wrapper.querySelector(`[data-photo-remove="${prefix}"]`);
            const resetBtn = wrapper.querySelector(`[data-photo-reset="${prefix}"]`);
            const removeCheckbox = document.getElementById(`${prefix}RemovePhoto`);

            const initialUrl = existingPhotoUrl || '';

            const togglePlaceholder = (show) => {
                if (!preview) return;
                if (show) {
                    preview.textContent = 'Aucune image';
                    preview.style.backgroundImage = 'none';
                    preview.classList.add('text-slate-500');
                } else {
                    preview.textContent = '';
                    preview.classList.remove('text-slate-500');
                }
            };

            const resetPreviewToExisting = () => {
                if (!preview) return;
                if (initialUrl) {
                    preview.style.backgroundImage = `url('${initialUrl}')`;
                    preview.style.backgroundSize = 'cover';
                    preview.style.backgroundPosition = 'center';
                    togglePlaceholder(false);
                } else {
                    preview.style.backgroundImage = 'none';
                    togglePlaceholder(true);
                }
                if (removeBtn) {
                    removeBtn.classList.add('hidden');
                }
            };

            const handleFile = (file) => {
                if (!file || !preview) return;
                const objectUrl = URL.createObjectURL(file);
                preview.style.backgroundImage = `url('${objectUrl}')`;
                preview.style.backgroundSize = 'cover';
                preview.style.backgroundPosition = 'center';
                preview.dataset.objectUrl = objectUrl;
                togglePlaceholder(false);
                if (removeBtn) {
                    removeBtn.classList.remove('hidden');
                }
                if (removeCheckbox) {
                    removeCheckbox.checked = false;
                }
            };

            if (input) {
                input.addEventListener('change', (event) => {
                    const file = event.target.files && event.target.files[0];
                    if (file) {
                        handleFile(file);
                    }
                });
            }

            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    if (input) {
                        input.value = '';
                    }
                    if (preview && preview.dataset.objectUrl) {
                        URL.revokeObjectURL(preview.dataset.objectUrl);
                        preview.dataset.objectUrl = '';
                    }
                    resetPreviewToExisting();
                    if (removeCheckbox) {
                        removeCheckbox.checked = initialUrl ? true : false;
                    }
                });
            }

            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    if (input) {
                        input.value = '';
                    }
                    if (preview && preview.dataset.objectUrl) {
                        URL.revokeObjectURL(preview.dataset.objectUrl);
                        preview.dataset.objectUrl = '';
                    }
                    resetPreviewToExisting();
                    if (removeCheckbox) {
                        removeCheckbox.checked = false;
                    }
                });
            }

            if (removeCheckbox) {
                removeCheckbox.addEventListener('change', () => {
                    if (!preview) return;
                    const shouldRemove = removeCheckbox.checked;

                    if (shouldRemove) {
                        if (input) {
                            input.value = '';
                        }
                        if (preview.dataset.objectUrl) {
                            URL.revokeObjectURL(preview.dataset.objectUrl);
                            preview.dataset.objectUrl = '';
                        }
                        preview.style.backgroundImage = 'none';
                        togglePlaceholder(true);
                        if (removeBtn) {
                            removeBtn.classList.add('hidden');
                        }
                    } else {
                        resetPreviewToExisting();
                    }
                });
            }

            if (initialUrl) {
                resetPreviewToExisting();
            } else {
                togglePlaceholder(true);
            }
        }

        getTagState(mode = 'create') {
            return mode === 'edit' ? this.editingEntityTags : this.newEntityTags;
        }

        setTagState(mode, state) {
            if (mode === 'edit') {
                this.editingEntityTags = state;
            } else {
                this.newEntityTags = state;
            }
        }

        renderTagChips(mode = 'create') {
            const prefix = mode === 'edit' ? 'edit' : 'create';
            const container = document.getElementById(`${prefix}TagChips`);
            if (!container) return;

            const tags = this.getTagState(mode);
            if (!tags.length) {
                container.innerHTML = '<span class="text-xs text-slate-500">Aucun tag sélectionné</span>';
                return;
            }

            container.innerHTML = tags.map(tag => `
                <span class="inline-flex items-center gap-2 px-2 py-1 text-xs rounded-full bg-slate-900 border border-slate-700 text-slate-200">
                    <span>${this.escapeHtml(tag.label)}</span>
                    <button type="button" class="text-slate-400 hover:text-red-400" data-tag-remove="${prefix}" data-tag-value="${tag.value}" aria-label="Retirer le tag ${this.escapeHtml(tag.label)}">
                        <i class="fas fa-times"></i>
                    </button>
                </span>
            `).join('');

            container.querySelectorAll(`[data-tag-remove="${prefix}"]`).forEach(btn => {
                btn.addEventListener('click', () => {
                    const value = btn.getAttribute('data-tag-value');
                    this.removeTagFromState(mode, value);
                    this.renderTagChips(mode);
                    this.renderTagSuggestions(mode);
                });
            });
        }

        renderTagSuggestions(mode = 'create') {
            const prefix = mode === 'edit' ? 'edit' : 'create';
            const container = document.getElementById(`${prefix}TagSuggestions`);
            if (!container) return;

            const state = this.getTagState(mode);
            const usedValues = new Set(state.map(tag => tag.value));
            const suggestions = this.availableTags
                .filter(tag => !usedValues.has(tag.value))
                .slice(0, 20);

            if (!suggestions.length) {
                container.innerHTML = '<span class="text-xs text-slate-500">Aucune suggestion disponible</span>';
                return;
            }

            container.innerHTML = suggestions.map(tag => `
                <button type="button" class="px-2 py-1 text-xs rounded-full bg-slate-900 border border-slate-700 text-slate-200 hover:border-blue-500 transition-colors" data-tag-suggest="${prefix}" data-tag-value="${tag.value}">
                    ${this.escapeHtml(tag.label)}
                </button>
            `).join('');

            container.querySelectorAll(`[data-tag-suggest="${prefix}"]`).forEach(btn => {
                btn.addEventListener('click', () => {
                    const value = btn.getAttribute('data-tag-value');
                    const suggestion = this.availableTags.find(tag => tag.value === value);
                    if (!suggestion) return;
                    this.addTagToState(mode, suggestion.label);
                    this.renderTagChips(mode);
                    this.renderTagSuggestions(mode);
                });
            });
        }

        attachTagInputHandlers(mode = 'create') {
            const prefix = mode === 'edit' ? 'edit' : 'create';
            const input = document.getElementById(`${prefix}TagInput`);
            const addBtn = document.querySelector(`[data-tag-add="${prefix}"]`);
            const clearBtn = document.querySelector(`[data-tag-clear="${prefix}"]`);

            const commitInput = () => {
                if (!input) return;
                const label = this.formatTagLabel(input.value);
                if (!label) return;
                this.addTagToState(mode, label);
                input.value = '';
                this.renderTagChips(mode);
                this.renderTagSuggestions(mode);
            };

            if (input) {
                input.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        commitInput();
                    }
                });
            }

            if (addBtn) {
                addBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    commitInput();
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    this.setTagState(mode, []);
                    this.renderTagChips(mode);
                    this.renderTagSuggestions(mode);
                    if (input) {
                        input.value = '';
                    }
                });
            }

            this.renderTagChips(mode);
            this.renderTagSuggestions(mode);
        }

        addTagToState(mode, label) {
            const state = [...this.getTagState(mode)];
            const normalized = this.normalizeTagValue(label);
            if (!normalized) return;
            if (state.some(tag => tag.value === normalized)) {
                return;
            }
            state.push({ label: this.formatTagLabel(label), value: normalized });
            this.setTagState(mode, state);
        }

        removeTagFromState(mode, value) {
            const normalized = this.normalizeTagValue(value);
            if (!normalized) return;
            const state = this.getTagState(mode).filter(tag => tag.value !== normalized);
            this.setTagState(mode, state);
        }

        formatTagLabel(label) {
            if (!label || typeof label !== 'string') return '';
            return label.trim().replace(/\s+/g, ' ').slice(0, 50);
        }

        normalizeTagValue(label) {
            if (!label || typeof label !== 'string') return '';
            return label.trim().toLowerCase().replace(/\s+/g, '-');
        }

        convertEntityTagsToState(tags) {
            if (!Array.isArray(tags)) return [];
            const seen = new Set();
            const result = [];

            tags.forEach(tag => {
                const nameValue = (tag && typeof tag.name === 'string') ? tag.name : '';
                const label = this.formatTagLabel(nameValue);
                const value = this.normalizeTagValue(label);
                if (!value || seen.has(value)) {
                    return;
                }
                seen.add(value);
                result.push({ label, value });
            });

            return result;
        }

        getTagLabelsFromState(state) {
            if (!Array.isArray(state)) return [];
            const seen = new Set();
            const labels = [];

            state.forEach(tag => {
                const label = this.formatTagLabel(tag && tag.label);
                const value = this.normalizeTagValue(label);
                if (!value || seen.has(value)) return;
                seen.add(value);
                labels.push(label);
            });

            return labels;
        }

        addNewEntityLinkRow() {
            const container = document.getElementById('newEntityLinksContainer');
            if (!container) return;

            const options = this.buildEntitySelectOptions();
            if (!options) {
                this.showNotification('Aucun autre élément disponible pour créer un lien', 'error');
                return;
            }

            const row = document.createElement('div');
            row.className = 'space-y-3 bg-slate-900/60 border border-slate-700 rounded-lg p-4';
            row.dataset.newLinkRow = 'true';
            row.innerHTML = `
                <div class="grid gap-3 sm:grid-cols-2">
                    <div class="space-y-2">
                        <label class="text-xs uppercase tracking-[0.2em] text-slate-400">Associer à</label>
                        <select class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:border-blue-500 focus:outline-none" data-link-target>
                            <option value="">Choisir un élément…</option>
                            ${options}
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-xs uppercase tracking-[0.2em] text-slate-400">Type de lien</label>
                        <input type="text"
                               class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                               placeholder="Ex : travaille avec, situé à…"
                               data-link-title>
                    </div>
                </div>
                <div class="space-y-2">
                    <label class="text-xs uppercase tracking-[0.2em] text-slate-400">Description (optionnelle)</label>
                    <textarea rows="2"
                              class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                              placeholder="Contexte du lien"
                              data-link-description></textarea>
                </div>
                <div class="flex justify-end">
                    <button type="button"
                            class="text-xs px-3 py-1 rounded-full bg-slate-900 border border-red-500/40 text-red-400 hover:text-red-300 transition-colors"
                            onclick="app.removeNewEntityLinkRow(this)">
                        <i class="fas fa-times mr-1"></i>Supprimer
                    </button>
                </div>
            `;

            container.appendChild(row);
        }

        removeNewEntityLinkRow(buttonEl) {
            if (!buttonEl) return;
            const row = buttonEl.closest('[data-new-link-row]');
            if (row && row.parentNode) {
                row.parentNode.removeChild(row);
            }
        }

        buildEntitySelectOptions() {
            if (!Array.isArray(this.entities) || this.entities.length === 0) {
                return '';
            }
            const typeLabels = {
                person: 'Personne',
                location: 'Lieu',
                evidence: 'Preuve',
                event: 'Événement'
            };
            return this.entities
                .map(entity => {
                    const label = this.escapeHtml(entity.title || 'Sans titre');
                    const typeLabel = typeLabels[entity.type] || entity.type;
                    return `<option value="${entity.id}">${label} (${typeLabel})</option>`;
                })
                .join('');
        }

        collectNewEntityLinkRequests() {
            const container = document.getElementById('newEntityLinksContainer');
            if (!container) return [];

            const rows = Array.from(container.querySelectorAll('[data-new-link-row]'));
            const requests = [];

            rows.forEach(row => {
                const targetSelect = row.querySelector('[data-link-target]');
                const titleInput = row.querySelector('[data-link-title]');
                const descriptionInput = row.querySelector('[data-link-description]');
                const targetId = targetSelect ? targetSelect.value : '';
                if (!targetId) return;

                requests.push({
                    toEntityId: targetId,
                    title: (titleInput?.value || '').trim(),
                    description: (descriptionInput?.value || '').trim()
                });
            });

            return requests;
        }

        async createLinksForNewEntity(newEntityId, pendingLinks) {
            if (!pendingLinks.length) {
                return [];
            }

            const errors = [];

            for (const link of pendingLinks) {
                const payload = {
                    from_entity_id: newEntityId,
                    to_entity_id: link.toEntityId,
                    title: link.title || 'Associé à',
                    description: link.description || ''
                };

                if (!payload.to_entity_id || payload.to_entity_id === newEntityId) {
                    continue;
                }

                try {
                    const response = await fetch(`/api/investigation/${this.investigationId}/links/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': this.csrfToken
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const data = await response.json().catch(() => ({}));
                        errors.push(data.error || 'Impossible de créer l\'un des liens');
                    }
                } catch (error) {
                    console.error('Error creating link for new entity:', error);
                    errors.push('Une erreur est survenue lors de la création d\'un lien');
                }
            }

            return errors;
        }

        openAddTypeModal() {
            document.getElementById('addTypeModal')?.classList.remove('hidden');
        }

        closeAddTypeModal() {
            document.getElementById('addTypeModal')?.classList.add('hidden');
        }

        async handleEntityFormSubmit(event) {
            event.preventDefault();

            const submitButton = document.getElementById('entityFormSubmitButton');
            if (submitButton) {
                submitButton.disabled = true;
            }

            try {
                const formElement = event.target;
                if (this.currentFormMode === 'edit') {
                    await this.submitUpdateEntity(formElement);
                } else {
                    await this.submitCreateEntity(formElement);
                }
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        }

        async submitCreateEntity(formElement) {
            if (!formElement) return;

            const type = this.currentFormType;
            if (!type) {
                this.showNotification('Type d\'élément inconnu', 'error');
                return;
            }

            const formData = new FormData(formElement);
            const payload = {
                type,
                title: formData.get('title'),
                description: formData.get('description') || '',
                role: formData.get('role') || '',
                location: formData.get('location') || '',
                address: formData.get('address') || '',
                event_date: formData.get('event_date') || null,
                event_end_date: formData.get('event_end_date') || null,
                is_timeslot: formData.get('is_timeslot') === 'on',
                evidence_type: formData.get('evidence_type') || '',
                tags: this.getTagLabelsFromState(this.newEntityTags)
            };

            const pendingLinks = this.collectNewEntityLinkRequests();

            try {
                const response = await fetch(`/api/investigation/${this.investigationId}/entities/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.csrfToken
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.error || 'Impossible de créer l\'élément');
                }

                const newEntityId = data.id;

                try {
                    const fileInput = document.getElementById('createPhotoInput');
                    if (fileInput && fileInput.files && fileInput.files[0] && newEntityId) {
                        await this.uploadEntityPhoto(newEntityId, fileInput.files[0]);
                    }
                } catch (photoError) {
                    console.warn('Photo upload failed for new entity:', photoError);
                    this.showNotification('L\'élément est créé mais la photo n\'a pas pu être téléversée', 'error');
                }

                let linkErrors = [];
                if (pendingLinks.length && newEntityId) {
                    linkErrors = await this.createLinksForNewEntity(newEntityId, pendingLinks);
                }

                this.closeEntityFormModal();
                await this.loadData();

                this.showNotification(`${this.getCreateModalTitle(type)} – succès`, 'success');

                if (pendingLinks.length && linkErrors.length === 0) {
                    this.showNotification('Liens créés avec succès', 'success');
                } else if (linkErrors.length) {
                    this.showNotification(linkErrors[0], 'error');
                }
            } catch (error) {
                console.error('Error adding entity:', error);
                this.showNotification(error.message || 'Erreur lors de la création', 'error');
            }
        }

        async openLinkModal(entityId = null) {
            if (this.isDetailOpen()) {
                this.closeEntityDetail();
            }
            const modal = document.getElementById('linkModal');
            const fromSelect = document.getElementById('fromEntitySelect');
            const toSelect = document.getElementById('toEntitySelect');

            // Populate entity selects
            const options = this.entities.map(entity => {
                const labels = {
                    person: 'Personne',
                    location: 'Lieu',
                    evidence: 'Preuve',
                    event: 'Événement'
                };
                const typeLabel = labels[entity.type] || entity.type;
                return `<option value="${entity.id}">${entity.title} (${typeLabel})</option>`;
            }).join('');

            fromSelect.innerHTML = options;
            toSelect.innerHTML = options;

            if (entityId) {
                fromSelect.value = entityId;
            }

            modal.classList.remove('hidden');
        }

        closeLinkModal() {
            document.getElementById('linkModal').classList.add('hidden');
        }

        async addLink(event) {
            event.preventDefault();

            const formData = new FormData(event.target);
            const data = {
                from_entity_id: formData.get('from_entity'),
                to_entity_id: formData.get('to_entity'),
                title: formData.get('title'),
                description: formData.get('description') || ''
            };

            if (data.from_entity_id === data.to_entity_id) {
                this.showNotification('Impossible de créer un lien vers la même entité', 'error');
                return;
            }

            try {
                const response = await fetch(`/api/investigation/${this.investigationId}/links/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.csrfToken
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    this.closeLinkModal();
                    await this.loadData();
                    this.showNotification('Lien créé avec succès !', 'success');
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to add link');
                }
            } catch (error) {
                console.error('Error adding link:', error);
                this.showNotification(error.message || 'Erreur lors de la création du lien', 'error');
            }
        }

        async editEntity(id) {
            const entity = this.entities.find(e => e.id === id);
            if (!entity) return;

            this.editingEntity = entity;
            const modal = document.getElementById('editModal');
            const fields = document.getElementById('editFormFields');

            let fieldHTML = '';

            switch(entity.type) {
                case 'person':
                    fieldHTML = `
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Nom</label>
                                <input type="text" name="title" value="${entity.title}" required
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Rôle</label>
                                <input type="text" name="role" value="${entity.role || ''}"
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Description</label>
                                <textarea name="description" rows="3"
                                          class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">${entity.description || ''}</textarea>
                            </div>
                        </div>
                    `;
                    break;
                case 'location':
                    fieldHTML = `
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Nom du lieu</label>
                                <input type="text" name="title" value="${entity.title}" required
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Zone / Ville</label>
                                <input type="text" name="location" value="${entity.location || ''}"
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Adresse</label>
                                <input type="text" name="address" value="${entity.address || ''}"
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Description</label>
                                <textarea name="description" rows="3"
                                          class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">${entity.description || ''}</textarea>
                            </div>
                        </div>
                    `;
                    break;
                case 'evidence':
                    fieldHTML = `
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Titre</label>
                                <input type="text" name="title" value="${entity.title}" required
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Type</label>
                                <select name="evidence_type"
                                        class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                                    <option value="document" ${entity.evidence_type === 'document' ? 'selected' : ''}>Document</option>
                                    <option value="photo" ${entity.evidence_type === 'photo' ? 'selected' : ''}>Photo</option>
                                    <option value="video" ${entity.evidence_type === 'video' ? 'selected' : ''}>Vidéo</option>
                                    <option value="audio" ${entity.evidence_type === 'audio' ? 'selected' : ''}>Audio</option>
                                    <option value="other" ${entity.evidence_type === 'other' ? 'selected' : ''}>Autre</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Description</label>
                                <textarea name="description" rows="3"
                                          class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">${entity.description || ''}</textarea>
                            </div>
                        </div>
                    `;
                    break;
                case 'event': {
                    const eventDateValue = this.formatDateTimeForInput(entity.event_date);
                    const eventEndDateValue = this.formatDateTimeForInput(entity.event_end_date);
                    fieldHTML = `
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Titre</label>
                                <input type="text" name="title" value="${entity.title}" required
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Début</label>
                                <input type="datetime-local" name="event_date" value="${eventDateValue}" required
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Fin (optionnel)</label>
                                <input type="datetime-local" name="event_end_date" value="${eventEndDateValue}"
                                       class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Description</label>
                                <textarea name="description" rows="3"
                                          class="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none">${entity.description || ''}</textarea>
                            </div>
                            <label class="flex items-center space-x-3 text-sm text-slate-300">
                                <input type="checkbox" name="is_timeslot" ${entity.is_timeslot ? 'checked' : ''} class="h-4 w-4 text-blue-500 border border-slate-500 rounded">
                                <span>Cet événement est un créneau approximatif</span>
                            </label>
                            <p class="text-xs text-slate-400">Associez un lieu à l'événement via un lien dédié.</p>
                        </div>
                    `;
                    break;
                }
            }

            fields.innerHTML = fieldHTML;
            modal.classList.remove('hidden');
        }

        closeEditModal() {
            document.getElementById('editModal').classList.add('hidden');
            this.editingEntity = null;
        }

        async updateEntity(event) {
            event.preventDefault();

            if (!this.editingEntity) return;

            const formData = new FormData(event.target);
            const data = {
                title: formData.get('title'),
                description: formData.get('description') || '',
                role: formData.get('role') || '',
                location: formData.get('location') || '',
                address: formData.get('address') || '',
                event_date: formData.get('event_date') || null,
                event_end_date: formData.get('event_end_date') || null,
                is_timeslot: formData.get('is_timeslot') === 'on',
                evidence_type: formData.get('evidence_type') || ''
            };

            try {
                const response = await fetch(`/api/investigation/${this.investigationId}/entity/${this.editingEntity.id}/`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.csrfToken
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    this.closeEditModal();
                    await this.loadData();
                    this.showNotification('Élément mis à jour avec succès !', 'success');
                } else {
                    throw new Error('Failed to update entity');
                }
            } catch (error) {
                console.error('Error updating entity:', error);
                this.showNotification('Erreur lors de la mise à jour', 'error');
            }
        }

        async deleteEntity(id) {
            if (!id) return;
            if (!confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) {
                return;
            }

            try {
                const response = await fetch(`/api/investigation/${this.investigationId}/entity/${id}/`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRFToken': this.csrfToken
                    }
                });

                if (response.ok) {
                    this.closeEditModal();
                    await this.loadData();
                    this.showNotification('Élément supprimé avec succès !', 'success');
                } else {
                    throw new Error('Failed to delete entity');
                }
            } catch (error) {
                console.error('Error deleting entity:', error);
                this.showNotification('Erreur lors de la suppression', 'error');
            }
        }

        applyFilters() {
            this.refreshView();
            this.updateActiveFilterChips();
        }

        showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `fixed top-20 right-4 z-50 px-6 py-4 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300 ${
                type === 'success' ? 'bg-green-600' :
                type === 'error' ? 'bg-red-600' : 'bg-blue-600'
            } text-white`;

            notification.innerHTML = `
                <div class="flex items-center space-x-3">
                    <i class="fas ${type === 'success' ? 'fa-check' : type === 'error' ? 'fa-exclamation' : 'fa-info'} text-xl"></i>
                    <span>${message}</span>
                </div>
            `;

            document.body.appendChild(notification);

            setTimeout(() => {
                notification.classList.remove('translate-x-full');
            }, 100);

            setTimeout(() => {
                notification.classList.add('translate-x-full');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }
    }

    const app = new InvestigationApp(config);
    window.app = app;

    window.switchView = (view) => app.switchView(view);
    window.openAddModal = (type) => app.openAddModal(type);
    window.closeAddModal = () => app.closeAddModal();
    window.addEntity = (event) => app.addEntity(event);
    window.editEntity = (id) => app.editEntity(id);
    window.closeEditModal = () => app.closeEditModal();
    window.updateEntity = (event) => app.updateEntity(event);
    window.deleteEntity = (id) => app.deleteEntity(id);
    window.applyFilters = () => app.applyFilters();
    window.clearFilters = () => {
        document.querySelectorAll('#filterDropdown input[type=checkbox]').forEach(cb => { cb.checked = false; });
        const search = document.getElementById('searchInput');
        if (search) {
            search.value = '';
        }
        app.resetTypeFilters(true);
        app.resetAttributeFilters(true);
        app.searchTermRaw = '';
        app.searchTerm = '';
        app.applyFilters();
    };
    window.openLinkModal = (entityId) => app.openLinkModal(entityId);
    window.closeLinkModal = () => app.closeLinkModal();
    window.addLink = (event) => app.addLink(event);
    window.closeEntityDetailModal = () => app.closeEntityDetail();
    window.toggleFilterDropdown = () => {
        const dropdown = document.getElementById('filterDropdown');
        if (!dropdown) return;
        dropdown.classList.toggle('hidden');
    };

    document.addEventListener('click', function(e) {
        const btn = document.getElementById('filterButton');
        const dropdown = document.getElementById('filterDropdown');
        if (!dropdown || !btn) return;
        const target = e.target;
        if (dropdown.classList.contains('hidden')) return;
        if (btn.contains(target)) return;
        if (dropdown.contains(target)) return;
        dropdown.classList.add('hidden');
    });

    window.openAddTypeModal = () => app.openAddTypeModal();
    window.closeAddTypeModal = () => app.closeAddTypeModal();
    window.openInvestigationSettingsModal = () => app.openInvestigationSettingsModal();
    window.closeInvestigationSettingsModal = () => app.closeInvestigationSettingsModal();

    function copyInvestigationCode(buttonEl) {
        if (!buttonEl) return;
        const code = buttonEl.dataset.code;
        if (!code) return;

        const setSuccessState = () => {
            const label = buttonEl.querySelector('[data-code-display]');
            const icon = buttonEl.querySelector('i');
            const defaultClasses = ['text-blue-400', 'hover:text-blue-300', 'border-blue-500/40'];
            const successClasses = ['text-emerald-300', 'border-emerald-500/60', 'bg-emerald-500/10'];

            if (label) {
                label.textContent = buttonEl.dataset.copiedLabel || 'Copié !';
            }
            buttonEl.classList.remove(...defaultClasses);
            buttonEl.classList.add(...successClasses);
            if (icon) {
                icon.classList.replace('fa-copy', 'fa-check');
            }

            if (buttonEl._copyTimeout) {
                clearTimeout(buttonEl._copyTimeout);
            }

            buttonEl._copyTimeout = setTimeout(() => {
                if (label) {
                    label.textContent = buttonEl.dataset.originalLabel || code;
                }
                buttonEl.classList.remove(...successClasses);
                buttonEl.classList.add(...defaultClasses);
                if (icon) {
                    icon.classList.replace('fa-check', 'fa-copy');
                }
            }, 1600);
        };

        const setErrorState = () => {
            app.showNotification('Impossible de copier le code', 'error');
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code)
                .then(() => {
                    setSuccessState();
                    app.showNotification('Code copié dans le presse-papiers', 'success');
                })
                .catch(() => setErrorState());
            return;
        }

        const tempInput = document.createElement('input');
        tempInput.value = code;
        tempInput.setAttribute('readonly', '');
        tempInput.style.position = 'absolute';
        tempInput.style.opacity = '0';
        document.body.appendChild(tempInput);
        tempInput.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                setSuccessState();
                app.showNotification('Code copié dans le presse-papiers', 'success');
            } else {
                setErrorState();
            }
        } catch (err) {
            setErrorState();
        }

        document.body.removeChild(tempInput);
    }

    const investigationCodeButton = document.getElementById('investigationCodeBtn');
    if (investigationCodeButton) {
        investigationCodeButton.addEventListener('click', () => copyInvestigationCode(investigationCodeButton));
    }

    window.addEventListener('resize', () => {
        if (app.networkChart) {
            app.networkChart.resize();
        }
    });
})();