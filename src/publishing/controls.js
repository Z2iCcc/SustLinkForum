// Shared publishing controls. Imported from the reviewed prototype; disposed on React unmount.
export function bindPublishingControls(root, rules) {
  const svg = (path) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  const check = svg('<path d="m5 12 4 4L19 6"/>');
  const arrow = svg('<path d="m9 5 7 7-7 7"/>');
  let popup = null,
    trigger = null,
    tooltip = null,
    tipTrigger = null;
  let showTimer, hideTimer;
  const localDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () =>
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    );
  const parseDate = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T12:00:00") : today();
  function hideTip() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    tooltip?.remove();
    tooltip = null;
    tipTrigger?.removeAttribute("aria-describedby");
    tipTrigger = null;
  }
  function closePopup(restore = false) {
    const previous = trigger;
    if (previous) previous.setAttribute("aria-expanded", "false");
    popup?.disposeWheels?.();
    popup?.remove();
    popup = null;
    trigger = null;
    if (restore) previous?.focus({ preventScroll: true });
  }
  function position(layer, anchor, preferred = "bottom") {
    const r = anchor.getBoundingClientRect(),
      h = layer.offsetHeight,
      w = layer.offsetWidth;
    const below = innerHeight - r.bottom - 10,
      above = r.top - 10;
    const top =
      preferred === "top"
        ? above >= h
          ? r.top - h - 8
          : r.bottom + 8
        : below >= h || below >= above
          ? r.bottom + 7
          : r.top - h - 7;
    layer.dataset.side = top < r.top ? "top" : "bottom";
    let left = r.left;
    const container = anchor
      .closest(".publishing-panel")
      ?.getBoundingClientRect();
    if (
      layer.classList.contains("datetime-popover") &&
      container &&
      left + w > container.right - 14
    )
      left = Math.max(container.left + 14, r.right - w);
    layer.style.left = Math.max(12, Math.min(left, innerWidth - w - 12)) + "px";
    layer.style.top = Math.max(12, Math.min(top, innerHeight - h - 12)) + "px";
    if (layer.classList.contains("hint-bubble"))
      layer.style.setProperty(
        "--hint-arrow",
        Math.max(
          14,
          Math.min(r.left + r.width / 2 - parseFloat(layer.style.left), w - 14),
        ) + "px",
      );
  }
  function showTip(button) {
    if (!button.isConnected) return;
    hideTip();
    closePopup();
    tipTrigger = button;
    tooltip = document.createElement("div");
    tooltip.className = "publishing-tooltip hint-bubble";
    tooltip.id = "preview-helper-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.textContent = button.dataset.help;
    document.body.append(tooltip);
    button.setAttribute("aria-describedby", tooltip.id);
    position(tooltip, button, "bottom");
    tooltip.addEventListener("pointerenter", () => clearTimeout(hideTimer));
    tooltip.addEventListener(
      "pointerleave",
      () => (hideTimer = setTimeout(hideTip, 160)),
    );
  }
  const helpCleanups = [];
  const listenHelp = (button, event, handler) => {
    button.addEventListener(event, handler);
    helpCleanups.push(() => button.removeEventListener(event, handler));
  };
  function bindHelp(root) {
    root.querySelectorAll("[data-help]").forEach((button) => {
      listenHelp(button, "pointerenter", () => {
        clearTimeout(hideTimer);
        clearTimeout(showTimer);
        showTimer = setTimeout(() => showTip(button), 500);
      });
      listenHelp(button, "pointerleave", () => {
        clearTimeout(showTimer);
        if (!button.matches(":focus-visible"))
          hideTimer = setTimeout(hideTip, 160);
      });
      listenHelp(button, "focus", () => {
        if (button.matches(":focus-visible")) showTip(button);
      });
      listenHelp(button, "blur", () => {
        if (tipTrigger === button) hideTip();
      });
      listenHelp(button, "click", () => {
        if (tipTrigger === button && tooltip) hideTip();
        else showTip(button);
      });
    });
  }
  function buildPopup(button, kind) {
    hideTip();
    closePopup();
    trigger = button;
    button.setAttribute("aria-expanded", "true");
    popup = document.createElement("div");
    popup.id = button.getAttribute("aria-controls");
    popup.className = "publishing-popup control-popover " + kind;
    document.body.append(popup);
    return popup;
  }
  function openSelect(button, keyboard = false) {
    if (trigger === button) {
      closePopup();
      return;
    }
    const field = document.getElementById(button.dataset.field),
      options = JSON.parse(button.dataset.options);
    const layer = buildPopup(button, "option-popover");
    layer.setAttribute("role", "listbox");
    layer.setAttribute("aria-label", button.dataset.label);
    layer.style.width =
      Math.min(Math.max(178, button.offsetWidth), innerWidth - 24) + "px";
    layer.style.maxHeight = Math.min(320, innerHeight - 24) + "px";
    options.forEach((value) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "choice-option";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(field.value === value));
      option.tabIndex = -1;
      const text = document.createElement("span");
      text.textContent = value;
      option.append(text);
      if (field.value === value) option.insertAdjacentHTML("beforeend", check);
      option.onclick = () => {
        field.value = value;
        button.querySelector(".control-value").textContent = value;
        button.classList.remove("empty-value");
        // Close and restore focus before React replaces a board/mode's form.
        closePopup(true);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      };
      layer.append(option);
    });
    const move = (index) => {
      const option = layer.children[(index + options.length) % options.length];
      option.focus({ preventScroll: true });
      // Only scroll the list, never its document ancestors (notably WebView).
      const top = option.offsetTop;
      const bottom = top + option.offsetHeight;
      if (top < layer.scrollTop) layer.scrollTop = top;
      else if (bottom > layer.scrollTop + layer.clientHeight)
        layer.scrollTop = bottom - layer.clientHeight;
    };
    layer.onkeydown = (e) => {
      const index = [...layer.children].indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        move(index + (e.key === "ArrowDown" ? 1 : -1));
      }
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        move(e.key === "Home" ? 0 : options.length - 1);
      }
      if (e.key === "Tab") closePopup(true);
    };
    position(layer, button);
    move(Math.max(0, options.indexOf(field.value)));
  }
  function openCalendar(button, keyboard = false) {
    if (trigger === button) {
      closePopup();
      return;
    }
    const field = document.getElementById(button.dataset.field),
      timed = button.dataset.control === "datetime";
    const currentDay = today(),
      now = new Date();
    const bounds = timed
      ? rules.timeBounds(field.name)
      : { min: "1900-01-01T00:00", max: localDate(currentDay) + "T23:59" };
    const firstDay = bounds.min.slice(0, 10),
      lastDay = bounds.max.slice(0, 10),
      limit = parseDate(lastDay),
      minYear = Number(firstDay.slice(0, 4));
    const dateAllowed = (value) => value >= firstDay && value <= lastDay;
    const boundDay = (value) =>
      value < firstDay ? firstDay : value > lastDay ? lastDay : value;
    let initialValue =
      field.value ||
      `${localDate(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (timed)
      initialValue =
        initialValue < bounds.min
          ? bounds.min
          : initialValue > bounds.max
            ? bounds.max
            : initialValue;
    const initial = parseDate(boundDay(initialValue.slice(0, 10)));
    let selected = timed ? localDate(initial) : field.value.slice(0, 10),
      focused = selected || localDate(currentDay);
    let month = new Date(initial.getFullYear(), initial.getMonth(), 1),
      yearStart = Math.floor(month.getFullYear() / 12) * 12;
    const initialTime = initialValue.split("T")[1] || "00:00";
    let hour = Number(initialTime.slice(0, 2)),
      minute = Number(initialTime.slice(3, 5));
    function timeWindow() {
      const toMinutes = (value) =>
        Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16));
      return {
        min: selected === firstDay ? toMinutes(bounds.min) : 0,
        max: selected === lastDay ? toMinutes(bounds.max) : 1439,
      };
    }
    function fitTime() {
      const range = timeWindow(),
        value = Math.max(range.min, Math.min(range.max, hour * 60 + minute));
      hour = Math.floor(value / 60);
      minute = value % 60;
    }
    function valueRange(unit) {
      const range = timeWindow();
      return unit === "hour"
        ? [Math.floor(range.min / 60), Math.floor(range.max / 60)]
        : [
            Math.max(0, range.min - hour * 60),
            Math.min(59, range.max - hour * 60),
          ];
    }
    const layer = buildPopup(
      button,
      "calendar-popover" + (timed ? " datetime-popover" : ""),
    );
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-label", button.dataset.label + "选择日历");
    const commit = (value) => {
      if (
        value &&
        (timed ? !rules.timeValid(field.name, value) : !dateAllowed(value))
      )
        return;
      field.value = value;
      button.querySelector(".control-value").textContent = value
        ? value.replaceAll("-", " / ").replace("T", "  ")
        : timed
          ? "选择日期和时间"
          : "选择日期";
      button.classList.toggle("empty-value", !value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      closePopup(true);
    };
    const selectDate = (value) => {
      if (!dateAllowed(value)) return;
      if (!timed) {
        commit(value);
        return;
      }
      selected = focused = value;
      fitTime();
      month = new Date(
        parseDate(value).getFullYear(),
        parseDate(value).getMonth(),
        1,
      );
      draw(true);
    };
    const footer = () =>
      `<div class="calendar-bottom"><button type="button" class="calendar-clear">清除</button><button type="button" class="calendar-today">今天</button></div>`;
    function mount(markup) {
      layer.disposeWheels?.();
      layer.innerHTML = `<div class="calendar-panel">${markup}</div>${timed ? `<section class="time-panel" aria-label="选择时间"><div class="time-heading">${svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>')}<span>时间</span></div><div class="time-wheels"></div><button type="button" class="datetime-confirm">确定</button></section>` : ""}`;
      if (timed) drawTime();
      layer.querySelector(".calendar-clear").onclick = () => commit("");
      layer.querySelector(".calendar-today").onclick = () =>
        selectDate(localDate(currentDay));
      layer.querySelector(".calendar-today").disabled = !dateAllowed(
        localDate(currentDay),
      );
    }
    function drawTime() {
      const wheels = layer.querySelector(".time-wheels");
      const wheelControllers = {};
      const cleanups = [];
      layer.disposeWheels = () => cleanups.forEach((dispose) => dispose());
      [
        ["hour", "时", 24],
        ["minute", "分", 60],
      ].forEach(([unit, label, total]) => {
        const group = document.createElement("div");
        group.className = "time-wheel-group";
        group.innerHTML = `<span class="time-unit">${label}</span><div class="time-wheel-frame"><div class="time-wheel" role="listbox" tabindex="0" aria-label="${unit === "hour" ? "小时" : "分钟"}"></div></div>`;
        wheels.append(group);
        const wheel = group.querySelector(".time-wheel");
        const row = 36,
          clamp = (value) => {
            const [low, high] = valueRange(unit);
            return Math.max(low * row, Math.min(high * row, value));
          };
        const reducedMotion = matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        let settleTimer,
          frame = 0,
          lastFrame = 0,
          target = 0,
          position = 0,
          pointerDown = false,
          lastDirection = 0,
          currentValue = -1;
        let drag = null,
          suppressClick = false;
        const active = () => (unit === "hour" ? hour : minute);
        const select = (value) => {
          value = clamp(value * row) / row;
          if (unit === "hour") hour = value;
          else minute = value;
          if (value === currentValue) return;
          currentValue = value;
          wheel
            .querySelectorAll("[role=option]")
            .forEach((option) =>
              option.setAttribute(
                "aria-selected",
                String(Number(option.dataset.time) === value),
              ),
            );
          wheel.setAttribute(
            "aria-activedescendant",
            `${button.id}-${unit}-${value}`,
          );
          if (unit === "hour") wheelControllers.minute?.refresh();
        };
        const sync = () => select(Math.round(clamp(wheel.scrollTop) / row));
        function stop() {
          clearTimeout(settleTimer);
          cancelAnimationFrame(frame);
          frame = 0;
          lastFrame = 0;
          lastDirection = 0;
          target = position = wheel.scrollTop;
        }
        function tick(now) {
          if (!wheel.isConnected) {
            stop();
            return;
          }
          const elapsed = Math.min(48, now - (lastFrame || now - 16));
          lastFrame = now;
          const distance = target - position;
          if (Math.abs(distance) < 0.5) {
            position = target;
            wheel.scrollTop = target;
            sync();
            frame = 0;
            lastFrame = 0;
            return;
          }
          // Retain subpixel progress even when the browser rounds scrollTop to physical pixels.
          position += distance * (1 - Math.exp(-elapsed / 45));
          wheel.scrollTop = position;
          sync();
          frame = requestAnimationFrame(tick);
        }
        function animateTo(value) {
          target = clamp(value);
          if (reducedMotion) {
            position = target;
            wheel.scrollTop = target;
            sync();
            return;
          }
          if (!frame) {
            position = wheel.scrollTop;
            lastFrame = 0;
            frame = requestAnimationFrame(tick);
          }
        }
        function settle() {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(() => {
            if (!wheel.isConnected || pointerDown) return;
            // Snap once the gesture ends, rather than forcing every wheel event onto a row.
            animateTo(
              Math.round((frame ? target : wheel.scrollTop) / row) * row,
            );
          }, 160);
        }
        function jump(value) {
          stop();
          target = position = clamp(value * row);
          wheel.scrollTop = target;
          select(target / row);
        }
        for (let value = 0; value < total; value++) {
          const option = document.createElement("div");
          option.id = `${button.id}-${unit}-${value}`;
          option.dataset.time = value;
          option.setAttribute("role", "option");
          option.className = "time-option";
          option.textContent = String(value).padStart(2, "0");
          option.onclick = () => {
            if (option.getAttribute("aria-disabled") === "true") return;
            jump(value);
            wheel.focus({ preventScroll: true });
          };
          wheel.append(option);
        }
        wheelControllers[unit] = {
          refresh() {
            const [low, high] = valueRange(unit);
            wheel
              .querySelectorAll("[role=option]")
              .forEach((option) =>
                option.setAttribute(
                  "aria-disabled",
                  String(
                    Number(option.dataset.time) < low ||
                      Number(option.dataset.time) > high,
                  ),
                ),
              );
            jump(active());
          },
        };
        wheel.addEventListener(
          "wheel",
          (e) => {
            if (
              e.ctrlKey ||
              !e.deltaY ||
              Math.abs(e.deltaX) > Math.abs(e.deltaY)
            )
              return;
            if (drag) {
              e.preventDefault();
              return;
            }
            const mode = e.deltaMode;
            const pixels =
              e.deltaY *
              (mode === 1 ? row : mode === 2 ? wheel.clientHeight : 1);
            const direction = Math.sign(pixels);
            e.preventDefault();
            clearTimeout(settleTimer);
            if (!frame || direction !== lastDirection) target = wheel.scrollTop;
            lastDirection = direction;
            // Keep fine trackpad movement while limiting unusually large mouse/OS steps.
            animateTo(
              target + Math.sign(pixels) * Math.min(Math.abs(pixels), row * 3),
            );
            settle();
          },
          { passive: false },
        );
        wheel.addEventListener("scroll", () => {
          sync();
          if (!frame && !pointerDown) settle();
        });
        wheel.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          stop();
          pointerDown = true;
          suppressClick = false;
          if (e.pointerType === "mouse") {
            e.preventDefault();
            wheel.focus({ preventScroll: true });
            drag = {
              id: e.pointerId,
              y: e.clientY,
              scroll: wheel.scrollTop,
              moved: false,
            };
          }
        });
        const move = (e) => {
          if (!drag || e.pointerId !== drag.id) return;
          const distance = e.clientY - drag.y;
          if (!drag.moved && Math.abs(distance) < 4) return;
          if (!drag.moved) {
            drag.moved = true;
            wheel.classList.add("is-dragging");
            wheel.setPointerCapture(drag.id);
          }
          e.preventDefault();
          target = position = clamp(drag.scroll - distance);
          wheel.scrollTop = position;
          sync();
        };
        const release = (e) => {
          if (drag && e?.pointerId !== undefined && e.pointerId !== drag.id)
            return;
          const previous = drag;
          drag = null;
          wheel.classList.remove("is-dragging");
          if (previous) {
            suppressClick = previous.moved;
            if (wheel.hasPointerCapture(previous.id))
              wheel.releasePointerCapture(previous.id);
          }
          if (pointerDown) {
            pointerDown = false;
            settle();
          }
        };
        // A completed drag must not also click the number beneath the release point.
        wheel.addEventListener(
          "click",
          (e) => {
            if (suppressClick) {
              e.preventDefault();
              e.stopImmediatePropagation();
              suppressClick = false;
            }
          },
          true,
        );
        wheel.addEventListener("lostpointercapture", release);
        window.addEventListener("pointermove", move, { passive: false });
        window.addEventListener("pointerup", release);
        window.addEventListener("pointercancel", release);
        window.addEventListener("blur", release);
        cleanups.push(() => {
          const previous = drag;
          drag = null;
          pointerDown = false;
          stop();
          wheel.classList.remove("is-dragging");
          if (previous && wheel.hasPointerCapture(previous.id))
            wheel.releasePointerCapture(previous.id);
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", release);
          window.removeEventListener("pointercancel", release);
          window.removeEventListener("blur", release);
        });
        wheel.onkeydown = (e) => {
          let value = active();
          if (e.key === "ArrowDown") value++;
          else if (e.key === "ArrowUp") value--;
          else if (e.key === "PageDown") value += 5;
          else if (e.key === "PageUp") value -= 5;
          else if (e.key === "Home") value = valueRange(unit)[0];
          else if (e.key === "End") value = valueRange(unit)[1];
          else if (e.key === "Enter") {
            e.preventDefault();
            layer.querySelector(".datetime-confirm").click();
            return;
          } else return;
          e.preventDefault();
          jump(Math.max(0, Math.min(total - 1, value)));
        };
        wheelControllers[unit].refresh();
      });
      layer.querySelector(".datetime-confirm").onclick = () => {
        // Read the wheel centers as well, so confirming during a scroll keeps the visible time.
        const centers = [...wheels.querySelectorAll(".time-wheel")].map((w) =>
          Math.round(w.scrollTop / 36),
        );
        hour = Math.max(0, Math.min(23, centers[0]));
        minute = Math.max(0, Math.min(59, centers[1]));
        fitTime();
        commit(
          `${selected || localDate(currentDay)}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        );
      };
    }
    function drawYears(focusYear = month.getFullYear(), moveFocus = false) {
      layer.dataset.view = "years";
      mount(
        `<div class="calendar-heading"><button type="button" class="years-prev" aria-label="前 12 年" ${yearStart <= minYear ? "disabled" : ""}>${arrow}</button><span aria-live="polite">${yearStart} — ${Math.min(9999, yearStart + 11)}</span><button type="button" class="years-next" aria-label="后 12 年" ${yearStart + 12 > limit.getFullYear() ? "disabled" : ""}>${arrow}</button></div><div class="year-grid" role="grid" aria-label="选择年份"></div>${footer()}`,
      );
      const grid = layer.querySelector(".year-grid");
      for (let row = 0; row < 4; row++) {
        const rowEl = document.createElement("div");
        rowEl.setAttribute("role", "row");
        for (let col = 0; col < 3; col++) {
          const year = yearStart + row * 3 + col,
            cell = document.createElement("div"),
            option = document.createElement("button");
          cell.setAttribute("role", "gridcell");
          cell.setAttribute(
            "aria-selected",
            String(year === month.getFullYear()),
          );
          option.type = "button";
          option.dataset.year = year;
          option.textContent = year;
          option.setAttribute("aria-label", `${year} 年`);
          option.tabIndex = year === focusYear ? 0 : -1;
          option.disabled = year < minYear || year > limit.getFullYear();
          option.className = year === month.getFullYear() ? "selected" : "";
          if (year === currentDay.getFullYear())
            option.setAttribute("aria-current", "date");
          option.onclick = () => {
            let chosenMonth =
              year === limit.getFullYear()
                ? Math.min(month.getMonth(), limit.getMonth())
                : month.getMonth();
            if (year === minYear)
              chosenMonth = Math.max(
                chosenMonth,
                Number(firstDay.slice(5, 7)) - 1,
              );
            month = new Date(year, chosenMonth, 1);
            const preferredDay = parseDate(selected).getDate();
            const latestDay =
              year === limit.getFullYear() && chosenMonth === limit.getMonth()
                ? limit.getDate()
                : new Date(year, chosenMonth + 1, 0).getDate();
            focused = boundDay(
              localDate(
                new Date(year, chosenMonth, Math.min(preferredDay, latestDay)),
              ),
            );
            draw(true);
          };
          option.onkeydown = (e) => {
            let target = year;
            if (e.key === "ArrowLeft") target--;
            else if (e.key === "ArrowRight") target++;
            else if (e.key === "ArrowUp") target -= 3;
            else if (e.key === "ArrowDown") target += 3;
            else if (e.key === "Home") target = Math.max(minYear, yearStart);
            else if (e.key === "End")
              target = Math.min(yearStart + 11, limit.getFullYear());
            else if (e.key === "PageUp") target -= 12;
            else if (e.key === "PageDown") target += 12;
            else return;
            e.preventDefault();
            if (target < minYear || target > limit.getFullYear()) return;
            if (target < yearStart || target > yearStart + 11)
              yearStart = Math.max(minYear, Math.floor(target / 12) * 12);
            drawYears(target, true);
          };
          cell.append(option);
          rowEl.append(cell);
        }
        grid.append(rowEl);
      }
      layer.querySelector(".years-prev").onclick = () => {
        yearStart = Math.max(minYear, yearStart - 12);
        drawYears(yearStart, true);
      };
      layer.querySelector(".years-next").onclick = () => {
        yearStart += 12;
        drawYears(yearStart, true);
      };
      position(layer, button);
      if (moveFocus)
        layer
          .querySelector(`[data-year="${focusYear}"]`)
          ?.focus({ preventScroll: true });
    }
    function draw(moveFocus = false) {
      layer.dataset.view = "days";
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1),
        previousMonthEnd = new Date(month.getFullYear(), month.getMonth(), 0);
      mount(
        `<div class="calendar-heading"><button type="button" class="calendar-prev" aria-label="上个月" ${localDate(previousMonthEnd) < firstDay ? "disabled" : ""}>${arrow}</button><button type="button" class="calendar-year-toggle" aria-label="选择年份，当前 ${month.getFullYear()} 年 ${month.getMonth() + 1} 月"><span>${month.getFullYear()} 年 ${month.getMonth() + 1} 月</span>${svg('<path d="m7 10 5 5 5-5"/>')}</button><button type="button" class="calendar-next" aria-label="下个月" ${localDate(nextMonth) > lastDay ? "disabled" : ""}>${arrow}</button></div><table class="calendar-grid" role="grid" aria-label="${month.getFullYear()} 年 ${month.getMonth() + 1} 月"><thead><tr>${["一", "二", "三", "四", "五", "六", "日"].map((d) => '<th scope="col">' + d + "</th>").join("")}</tr></thead><tbody></tbody></table>${footer()}`,
      );
      const first = new Date(month);
      first.setDate(1 - ((first.getDay() + 6) % 7));
      // A fixed six-week grid keeps the popup and footer still between months.
      const days = 42;
      for (let i = 0; i < days; i += 7) {
        const row = layer.querySelector("tbody").insertRow();
        for (let j = 0; j < 7; j++) {
          const date = new Date(first);
          date.setDate(first.getDate() + i + j);
          const value = localDate(date),
            cell = row.insertCell(),
            day = document.createElement("button");
          cell.setAttribute("role", "gridcell");
          cell.setAttribute("aria-selected", String(value === selected));
          day.type = "button";
          day.textContent = date.getDate();
          day.dataset.day = value;
          day.tabIndex = value === focused ? 0 : -1;
          day.setAttribute(
            "aria-label",
            `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
          );
          if (value === localDate(currentDay))
            day.setAttribute("aria-current", "date");
          day.className = [
            date.getMonth() !== month.getMonth() ? "adjacent" : "",
            value === selected ? "selected" : "",
            value === localDate(currentDay) ? "today" : "",
          ]
            .filter(Boolean)
            .join(" ");
          day.disabled = !dateAllowed(value);
          day.onclick = () => selectDate(value);
          day.onkeydown = (e) => {
            const target = parseDate(day.dataset.day);
            let offset = null;
            if (e.key === "ArrowLeft") offset = -1;
            if (e.key === "ArrowRight") offset = 1;
            if (e.key === "ArrowUp") offset = -7;
            if (e.key === "ArrowDown") offset = 7;
            if (e.key === "Home") offset = -(target.getDay() + 6) % 7;
            if (e.key === "End") offset = 6 - ((target.getDay() + 6) % 7);
            if (offset !== null) {
              e.preventDefault();
              target.setDate(target.getDate() + offset);
            } else if (e.key === "PageUp" || e.key === "PageDown") {
              e.preventDefault();
              const dayOfMonth = target.getDate();
              target.setDate(1);
              target.setMonth(
                target.getMonth() + (e.key === "PageDown" ? 1 : -1),
              );
              target.setDate(
                Math.min(
                  dayOfMonth,
                  new Date(
                    target.getFullYear(),
                    target.getMonth() + 1,
                    0,
                  ).getDate(),
                ),
              );
            } else return;
            if (!dateAllowed(localDate(target))) return;
            focused = localDate(target);
            month = new Date(target.getFullYear(), target.getMonth(), 1);
            draw(true);
          };
          cell.append(day);
        }
      }
      layer.querySelector(".calendar-prev").onclick = () => {
        month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
        draw();
      };
      layer.querySelector(".calendar-next").onclick = () => {
        month = nextMonth;
        draw();
      };
      layer.querySelector(".calendar-year-toggle").onclick = () => {
        yearStart = Math.max(
          minYear,
          Math.floor(month.getFullYear() / 12) * 12,
        );
        drawYears(month.getFullYear(), true);
      };
      position(layer, button);
      if (moveFocus)
        layer
          .querySelector(`[data-day="${focused}"]`)
          ?.focus({ preventScroll: true });
    }
    draw(keyboard);
  }

  function bind(root) {
    bindHelp(root);
    root.querySelectorAll("[data-control]").forEach((button) => {
      const open = ["date", "datetime"].includes(button.dataset.control)
        ? openCalendar
        : openSelect;
      button.onclick = (e) => open(button, e.detail === 0);
      button.onkeydown = (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (!popup) open(button, true);
        }
      };
    });
  }

  const pointerdown = (e) => {
    if (popup && !popup.contains(e.target) && !trigger?.contains(e.target))
      closePopup();
    if (
      tooltip &&
      !tooltip.contains(e.target) &&
      !tipTrigger?.contains(e.target)
    )
      hideTip();
  };
  const keydown = (e) => {
    if (e.key === "Escape" && (popup || tooltip)) {
      e.preventDefault();
      hideTip();
      closePopup(true);
    }
  };
  const focusin = (e) => {
    if (popup && !popup.contains(e.target) && !trigger?.contains(e.target))
      closePopup();
  };
  const resize = () => {
    hideTip();
    closePopup();
  };
  const scroll = () => {
    if (popup && trigger) position(popup, trigger);
    if (tooltip && tipTrigger) position(tooltip, tipTrigger);
  };
  document.addEventListener("pointerdown", pointerdown);
  document.addEventListener("keydown", keydown);
  document.addEventListener("focusin", focusin);
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", scroll, true);
  bind(root);
  return () => {
    hideTip();
    closePopup();
    helpCleanups.forEach((fn) => fn());
    document.removeEventListener("pointerdown", pointerdown);
    document.removeEventListener("keydown", keydown);
    document.removeEventListener("focusin", focusin);
    window.removeEventListener("resize", resize);
    window.removeEventListener("scroll", scroll, true);
    root.querySelectorAll("[data-control]").forEach((b) => {
      b.onclick = null;
      b.onkeydown = null;
    });
  };
}
