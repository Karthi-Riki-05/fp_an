// Wait for the minified App to load
function extendApp() {
  if (typeof App !== "undefined") {
    App.prototype.openGenerateDialog = function (prompt) {
      if (this.chatWindow == null) {
        this.chatWindow = new ChatWindow(this, 224, 104, 280, 320);
        this.chatWindow.window.addListener(
          "show",
          mxUtils.bind(this, function () {
            this.fireEvent(new mxEventObject("chat"));
          }),
        );
        this.chatWindow.window.addListener("hide", function () {
          this.fireEvent(new mxEventObject("chat"));
        });
        this.chatWindow.window.setVisible(true);
        this.fireEvent(new mxEventObject("chat"));
      } else {
        this.chatWindow.window.setVisible(true);
      }

      if (prompt != null) {
        this.chatWindow.generate(prompt);
      }
    };

    var ChatWindow = function (editorUi, x, y, w, h) {
      var graph = editorUi.editor.graph;
      console.log("ffffffffffffffffffffffffffffffffff");
      var div = document.createElement("div");
      div.style.display = "flex";
      div.style.flexDirection = "column";
      div.style.overflow = "hidden";
      div.style.height = "100%";
      div.style.padding = "10px 12px 20px 12px";
      div.style.boxSizing = "border-box";

      mxEvent.addGestureListeners(
        div,
        mxUtils.bind(this, function (evt) {
          if (editorUi.sidebar != null) {
            editorUi.sidebar.hideTooltip();
          }
        }),
        null,
        null,
      );

      var hist = document.createElement("div");
      hist.style.flexGrow = "1";
      hist.style.overflow = "auto";
      hist.style.fontSize = "12px";
      hist.style.marginRight = "-8px";
      hist.style.paddingRight = "8px";

      mxEvent.addListener(hist, "scroll", function () {
        if (editorUi.sidebar != null) {
          editorUi.sidebar.hideTooltip();
        }
      });

      div.appendChild(hist);

      var user = document.createElement("div");
      user.style.borderRadius = "20px";
      user.style.backgroundColor = "light-dark(#e0e0e0, #3a3a3a)";
      user.style.padding = "8px";
      user.style.marginTop = "8px";

      var options = document.createElement("div");
      options.style.display = "flex";
      options.style.gap = "6px";
      options.style.paddingRight = "8px";
      options.style.justifyContent = "start";

      var typeSelect = document.createElement("select");
      typeSelect.style.borderColor = "transparent";
      typeSelect.style.textOverflow = "ellipsis";
      typeSelect.style.padding = "5px";
      typeSelect.style.minWidth = "0";

      var createPublicOption = document.createElement("option");

      if (
        typeof mxMermaidToDrawio !== "undefined" &&
        window.isMermaidEnabled &&
        mxUtils.indexOf(Editor.aiActions, "createPublic") >= 0
      ) {
        createPublicOption.setAttribute("value", "createPublic");
        mxUtils.write(
          createPublicOption,
          mxResources.get("create") + " (" + mxResources.get("draw.io") + ")",
        );
        typeSelect.appendChild(createPublicOption);
      }

      var includeOption = document.createElement("option");
      var selectionOption = document.createElement("option");
      var createOption = document.createElement("option");
      var helpOption = document.createElement("option");

      if (
        typeof mxMermaidToDrawio !== "undefined" &&
        window.isMermaidEnabled &&
        mxUtils.indexOf(Editor.aiActions, "create") >= 0
      ) {
        createOption.setAttribute("value", "create");
        mxUtils.write(createOption, mxResources.get("create"));
        typeSelect.appendChild(createOption);
      }

      if (mxUtils.indexOf(Editor.aiActions, "update") >= 0) {
        includeOption.setAttribute("value", "includeCopyOfMyDiagram");
        mxUtils.write(includeOption, mxResources.get("includeCopyOfMyDiagram"));
        typeSelect.appendChild(includeOption);

        selectionOption.setAttribute("value", "selectionOnly");
        mxUtils.write(selectionOption, mxResources.get("selectionOnly"));
        typeSelect.appendChild(selectionOption);
      }

      if (mxUtils.indexOf(Editor.aiActions, "assist") >= 0) {
        helpOption.setAttribute("value", "assist");
        mxUtils.write(helpOption, mxResources.get("help"));
        typeSelect.appendChild(helpOption);
      }

      // Adds a drop down for selecting the model from Editor.aiModels
      var modelSelect = typeSelect.cloneNode(false);

      // Lists AI models with valid config and key
      for (var i = 0; i < Editor.aiModels.length; i++) {
        var model = Editor.aiModels[i];

        if (
          Editor.aiConfigs[model.config] &&
          Editor.aiGlobals[Editor.aiConfigs[model.config].apiKey] != null
        ) {
          console.log("ddddddddddddddddddddddddddddddddd");
          var modelOption = document.createElement("option");
          modelOption.setAttribute("value", model.name);
          mxUtils.write(modelOption, model.name);
          modelSelect.appendChild(modelOption);
        }
      }

      var publicChat = modelSelect.children.length == 0;
      var inner = document.createElement("div");
      inner.style.whiteSpace = "nowrap";
      inner.style.textOverflow = "clip";
      inner.style.cursor = "default";

      var inp = document.createElement("input");
      inp.setAttribute("type", "text");
      inp.style.width = "100%";
      inp.style.outline = "none";
      inp.style.border = "none";
      inp.style.background = "transparent";
      inp.style.padding = "6px 30px 6px 10px";
      inp.style.boxSizing = "border-box";
      inner.appendChild(inp);

      var sendImg = document.createElement("img");
      sendImg.setAttribute("src", Editor.sendImage);
      sendImg.setAttribute("title", mxResources.get("sendMessage"));
      sendImg.className = "geAdaptiveAsset";
      sendImg.style.position = "relative";
      sendImg.style.cursor = "pointer";
      sendImg.style.opacity = "0.5";
      sendImg.style.height = "19px";
      sendImg.style.left = "-28px";
      sendImg.style.top = "5px";
      inner.appendChild(sendImg);
      user.appendChild(inner);

      if (!publicChat) {
        if (urlParams["test"] != 1) {
          createPublicOption.parentNode.removeChild(createPublicOption);
        }

        options.appendChild(typeSelect);

        if (modelSelect.children.length > 1) {
          options.appendChild(modelSelect);
        }

        user.appendChild(options);
      }

      if (typeSelect.children.length > 0) {
        typeSelect.value = typeSelect.children[0].value;
      }

      var ignoreChange = false;
      var lastType = typeSelect.value;

      var updateDropdowns = function () {
        inp.setAttribute(
          "placeholder",
          mxResources.get(
            typeSelect.value == "create" || typeSelect.value == "createPublic"
              ? "describeYourDiagram"
              : "askMeAnything",
          ),
        );
      };

      updateDropdowns();

      function typeChanged() {
        if (!ignoreChange) {
          lastType = typeSelect.value;
          updateDropdowns();
        }

        modelSelect.style.display =
          typeSelect.value == "createPublic" ? "none" : "";
      }

      mxEvent.addListener(typeSelect, "change", typeChanged);
      typeChanged();

      function updateType() {
        ignoreChange = true;
        typeSelect.value = lastType;

        if (graph.isSelectionEmpty()) {
          selectionOption.setAttribute("disabled", "disabled");

          if (typeSelect.value == "selectionOnly") {
            typeSelect.value = "includeCopyOfMyDiagram";
          }
        } else {
          selectionOption.removeAttribute("disabled");
        }

        if (editorUi.isDiagramEmpty()) {
          includeOption.setAttribute("disabled", "disabled");

          if (typeSelect.value == "includeCopyOfMyDiagram") {
            typeSelect.value = "help";
          }
        } else {
          includeOption.removeAttribute("disabled");
        }

        ignoreChange = false;
      }

      graph.selectionModel.addListener(mxEvent.CHANGE, updateType);
      graph.getModel().addListener(mxEvent.CHANGE, updateType);
      updateType();

      function createBubble() {
        var bubble = document.createElement("div");
        bubble.style.textAlign = "left";
        bubble.style.padding = "6px";
        bubble.style.margin = "6px 0";

        return bubble;
      }

      function addBubble(text) {
        var bubble = createBubble();
        mxUtils.write(bubble, text);
        hist.appendChild(bubble);

        return bubble;
      }

      function addMessage(prompt) {
        var elts = [];
        var bubble = addBubble(prompt);
        elts.push(bubble);

        bubble.style.marginBottom = "2px";
        bubble.style.marginLeft = "40%";
        bubble.style.borderRadius = "10px";
        bubble.style.backgroundColor = "light-dark(#e0e0e0, #3a3a3a)";

        var buttons = document.createElement("div");
        buttons.className = "geInlineButtons";
        buttons.style.display = "flex";
        buttons.style.justifyContent = "end";
        elts.push(buttons);

        var btn = document.createElement("img");
        btn.className = "geAdaptiveAsset geLibraryButton";
        btn.setAttribute("src", Editor.trashImage);
        btn.setAttribute("title", mxResources.get("remove"));
        buttons.appendChild(btn);

        mxEvent.addListener(
          btn,
          "click",
          mxUtils.bind(this, function (evt) {
            if (mxEvent.isShiftDown(evt)) {
              hist.innerHTML = "";
            } else {
              // Removes all elements in elts from their parent
              for (var i = 0; i < elts.length; i++) {
                if (elts[i].parentNode != null) {
                  elts[i].parentNode.removeChild(elts[i]);
                }
              }

              elts = [];
            }
          }),
        );

        btn = btn.cloneNode();
        btn.setAttribute("src", Editor.copyImage);
        btn.setAttribute("title", mxResources.get("copy"));
        mxEvent.addListener(
          btn,
          "click",
          mxUtils.bind(this, function () {
            editorUi.writeTextToClipboard(
              prompt,
              mxUtils.bind(this, function (e) {
                editorUi.handleError(e);
              }),
              function () {
                editorUi.alert(mxResources.get("copiedToClipboard"));
              },
            );
          }),
        );
        buttons.appendChild(btn);

        btn = btn.cloneNode();
        btn.setAttribute("src", Editor.editImage);
        btn.setAttribute("title", mxResources.get("edit"));
        buttons.appendChild(btn);

        mxEvent.addListener(
          btn,
          "click",
          mxUtils.bind(this, function () {
            inp.value = prompt;
            inp.focus();

            if (
              mxClient.IS_GC ||
              mxClient.IS_FF ||
              document.documentMode >= 5
            ) {
              inp.select();
            } else {
              document.execCommand("selectAll", false, null);
            }
          }),
        );

        hist.appendChild(buttons);

        var waiting = addBubble("");
        waiting.className = "geSidebar";
        waiting.style.marginTop = "2px";

        function createRetryButton(title) {
          var buttons = document.createElement("div");
          buttons.style.display = "flex";

          var btn = document.createElement("img");
          btn.className = "geAdaptiveAsset geLibraryButton";
          btn.setAttribute("src", Editor.refreshImage);
          btn.setAttribute(
            "title",
            title != null ? title : mxResources.get("tryAgain"),
          );
          buttons.appendChild(btn);
          mxEvent.addListener(btn, "click", processMessage);

          return buttons;
        }

        function parseAIMarkup(text) {
          return (
            mxUtils
              .htmlEntities(text, false)
              // Headings (consume surrounding newlines)
              .replace(/\n*^##### (.+)$\n*/gm, "<h5>$1</h5>")
              .replace(/\n*^#### (.+)$\n*/gm, "<h4>$1</h4>")
              .replace(/\n*^### (.+)$\n*/gm, "<h3>$1</h3>")
              .replace(/\n*^## (.+)$\n*/gm, "<h2>$1</h2>")
              .replace(/\n*^# (.+)$\n*/gm, "<h1>$1</h1>")
              // Bold
              .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
              // Italic
              .replace(/\*(.+?)\*/g, "<em>$1</em>")
              // Inline code
              .replace(/`([^`]+)`/g, "<code>$1</code>")
          );
        }

        function createDivForText(text) {
          var wrapper = document.createElement("div");
          wrapper.style.whiteSpace = "pre-wrap";
          wrapper.innerHTML = Graph.sanitizeHtml(parseAIMarkup(text));

          return wrapper;
        }

        function createError(message) {
          var title = mxResources.get("error") + ": ";
          var wrapper = document.createElement("div");
          wrapper.style.whiteSpace = "pre-wrap";

          if (message.substring(0, title.length) != title) {
            message = title + message;
          }

          mxUtils.write(wrapper, message);
          wrapper.appendChild(createRetryButton());

          return wrapper;
        }

        var handleError = mxUtils.bind(this, function (e) {
          waiting.innerHTML = "";
          waiting.appendChild(createError(e.message));
          waiting.scrollIntoView({
            behavior: "smooth",
            block: "end",
            inline: "nearest",
          });
          EditorUi.debug("EditorUi.ChatWindow.handleError", "error", e);

          if (window.console != null) {
            console.error(e);
          }
        });

        var page = editorUi.currentPage;
        var theModel = modelSelect.value;
        var type = typeSelect.value;
        var aiModel = null;

        for (var i = 0; i < Editor.aiModels.length; i++) {
          var model = Editor.aiModels[i];

          if (model.name == theModel) {
            aiModel = model;
            break;
          }
        }

        if (
          type != "createPublic" &&
          (aiModel == null || Editor.aiConfigs[aiModel.config] == null)
        ) {
          handleError({
            message: mxResources.get("invalidCallFnNotFound", [theModel]),
          });

          return;
        }

        var config = aiModel != null ? Editor.aiConfigs[aiModel.config] : null;
        var thePrompt = prompt;
        var sentModel = null;
        var t0 = Date.now();
        var data = null;
        var xml = null;

        if (type == "includeCopyOfMyDiagram" || type == "selectionOnly") {
          var enc = new mxCodec(mxUtils.createXmlDocument());

          // Ignores unselected cells
          if (type == "selectionOnly") {
            enc.isObjectIgnored = function (obj) {
              return (
                obj.constructor == mxCell &&
                !graph.model.isRoot(obj) &&
                !graph.model.isLayer(obj) &&
                !graph.isCellSelected(obj) &&
                !graph.isAncestorSelected(obj)
              );
            };
          }

          xml = enc.encode(graph.getModel());

          // Sets xml.ownerDocument.documentElement == xml so
          // that forward references work correctly
          xml.ownerDocument.appendChild(xml);
          data = mxUtils.getXml(xml);
        }

        var resolver = function (name) {
          var value = null;

          if (name == "prompt") {
            value = thePrompt;
          } else if (name == "data" && xml != null) {
            value = data;
          } else if (name == "model") {
            value = aiModel.model;
          } else if (name == "apiKey") {
            name = config.apiKey;
          } else if (name == "action") {
            if (type == "selectionOnly" || type == "includeCopyOfMyDiagram") {
              name = "update";
            } else {
              name = type;
            }
          }

          if (value == null) {
            value = Editor.replacePlaceholders(
              Editor.aiGlobals[name],
              resolver,
            );
          }

          return value;
        };

        // Clones all properties of the given object and replaces
        // placeholders in string properties recursively
        var populateTemplate = function (obj, result) {
          if (result == null) {
            result = new obj.constructor();
          }

          for (var key in obj) {
            var value = obj[key];

            if (typeof value === "object") {
              result[key] = populateTemplate(value);
            } else if (typeof value === "string") {
              result[key] = Editor.replacePlaceholders(value, resolver);
            } else {
              result[key] = value;
            }
          }

          return result;
        };

        var params = config != null ? populateTemplate(config.request) : null;

        var processMessage = mxUtils.bind(this, function () {
          waiting.innerHTML = "";
          elts.push(waiting);

          var wrapper = document.createElement("div");
          wrapper.style.display = "flex";
          wrapper.style.alignItems = "center";
          mxUtils.write(wrapper, mxResources.get("loading") + "...");

          var img = document.createElement("img");
          img.className = "geAdaptiveAsset";
          img.setAttribute("src", Editor.svgSpinImage);
          img.style.width = "16px";
          img.style.height = "16px";
          img.style.marginLeft = "6px";
          wrapper.appendChild(img);
          waiting.appendChild(wrapper);

          waiting.scrollIntoView({
            behavior: "smooth",
            block: "end",
            inline: "nearest",
          });

          var handleResponse = mxUtils.bind(this, function (data, prompt) {
            var dt = Date.now() - t0;
            EditorUi.debug(
              "EditorUi.ChatWindow.handleResponse",
              "data",
              data,
              "prompt",
              [prompt],
              "time",
              dt,
            );
            var cells = null;

            if (data != null && data.length > 1 && data[1].length > 0) {
              try {
                cells = editorUi.stringToCells(data[1]);
              } catch (e) {
                throw new Error(e.toString() + "\n\n" + data[1]);
              }
            }

            if (cells != null && cells.length > 0) {
              var bbox = graph.getBoundingBoxFromGeometry(cells);
              editorUi.sidebar.graph.moveCells(cells, -bbox.x, -bbox.y);

              var clickFn = mxUtils.bind(this, function (e) {
                console.log("Image clicked");
                if (editorUi.sidebar != null) {
                  editorUi.sidebar.hideTooltip();
                }

                if (xml != null && sentModel == null) {
                  var dec = new mxCodec(xml.ownerDocument);
                  sentModel = new mxGraphModel();
                  dec.decode(xml, sentModel);
                }

                graph.model.beginUpdate();
                try {
                  if (
                    sentModel != null &&
                    page != null &&
                    editorUi.getPageIndex(page) != null
                  ) {
                    editorUi.selectPage(page);
                    var doc = mxUtils.parseXml(data[1]);
                    var codec = new mxCodec(doc);
                    var receivedModel = new mxGraphModel();
                    codec.decode(doc.documentElement, receivedModel);

                    // Creates a diff of the sent and recevied diagram
                    // to patch the current page and not lose changes
                    var patch = editorUi.diffCells(
                      sentModel.root,
                      receivedModel.root,
                    );
                    console.log("Diagram added via patchPage");
                    editorUi.patchPage(page, patch, null, true);
                    EditorUi.debug(
                      "EditorUi.ChatWindow.handleResponse",
                      "sentModel",
                      sentModel,
                      "receivedModel",
                      receivedModel,
                      "patch",
                      patch,
                    );
                  } else {
                    var pt = graph.getFreeInsertPoint();
                    console.log("Diagram added via importCells at point", pt);
                    graph.setSelectionCells(
                      graph.importCells(cells, pt.x, pt.y),
                    );
                    EditorUi.debug(
                      "EditorUi.ChatWindow.handleResponse",
                      "cells",
                      graph.getSelectionCell(),
                    );
                  }
                } finally {
                  graph.model.endUpdate();
                }

                graph.scrollCellToVisible(graph.getSelectionCell());
                mxEvent.consume(e);
              });

              waiting.innerHTML = "";
              bubble = waiting;

              if (data[0].length > 0) {
                bubble.appendChild(createDivForText(data[0]));
              }

              if (data[1].length > 0) {
                var svg = editorUi.getSvgForXml(data[1]);
                svg.style.overflow = "visible";
                svg.style.padding = "1px";
                svg.style.cursor = "move";
                svg.style.width = "160px";
                svg.style.height = "auto";
                svg.style.maxHeight = "460px";

                var item = document.createElement("a");
                item.className = "geItem";
                item.style.padding = "4px";
                item.style.borderRadius = "10px";
                item.appendChild(svg);
                bubble.appendChild(item);
                editorUi.sidebar.createItem(
                  cells,
                  prompt,
                  true,
                  true,
                  bbox.width,
                  bbox.height,
                  true,
                  true,
                  clickFn,
                  null,
                  null,
                  null,
                  null,
                  null,
                  item,
                );

                if (
                  !publicChat &&
                  type != "createPublic" &&
                  urlParams["test"] == 1
                ) {
                  item.setAttribute("title", theModel + " (" + dt + " ms)");
                }

                var buttons = document.createElement("div");
                buttons.style.display = "flex";

                var btn = document.createElement("img");
                btn.className = "geAdaptiveAsset geLibraryButton";
                btn.setAttribute("src", Editor.refreshImage);
                btn.setAttribute("title", mxResources.get("refresh"));
                buttons.appendChild(btn);
                mxEvent.addListener(btn, "click", processMessage);

                if (editorUi.getServiceName() == "draw.io") {
                  btn = btn.cloneNode();
                  btn.setAttribute("src", Editor.shareImage);
                  btn.setAttribute(
                    "title",
                    mxResources.get(
                      !editorUi.isStandaloneApp()
                        ? "openInNewWindow"
                        : "export",
                    ),
                  );
                  buttons.appendChild(btn);

                  mxEvent.addListener(
                    btn,
                    "click",
                    mxUtils.bind(this, function (evt) {
                      if (!editorUi.isStandaloneApp()) {
                        editorUi.editor.editAsNew(data[1]);
                      } else {
                        editorUi.saveData(
                          "export.xml",
                          "xml",
                          data[1],
                          "text/xml",
                        );
                      }
                    }),
                  );
                }

                btn = btn.cloneNode();
                btn.setAttribute("src", Editor.magnifyImage);
                btn.setAttribute("title", mxResources.get("preview"));
                buttons.appendChild(btn);

                mxEvent.addListener(
                  btn,
                  "click",
                  mxUtils.bind(this, function (evt) {
                    console.log("Preview button clicked");
                    var ww =
                      window.innerWidth ||
                      document.documentElement.clientWidth ||
                      document.body.clientWidth;
                    var wh =
                      window.innerHeight ||
                      document.documentElement.clientHeight ||
                      document.body.clientHeight;

                    editorUi.sidebar.createTooltip(
                      bubble,
                      cells,
                      Math.min(ww - 120, 1600),
                      Math.min(wh - 120, 1200),
                      prompt,
                      true,
                      new mxPoint(
                        mxEvent.getClientX(evt),
                        mxEvent.getClientY(evt),
                      ),
                      true,
                      function () {
                        wasVisible =
                          editorUi.sidebar.tooltip != null &&
                          editorUi.sidebar.tooltip.style.display != "none";
                      },
                      true,
                      false,
                    );
                  }),
                );

                btn = btn.cloneNode();

                if (
                  xml != null &&
                  page != null &&
                  editorUi.getPageIndex(page) != null
                ) {
                  btn.setAttribute("src", Editor.checkImage);
                  btn.setAttribute("title", mxResources.get("apply"));
                } else {
                  btn.setAttribute("src", Editor.plusImage);
                  btn.setAttribute("title", mxResources.get("insert"));
                }

                buttons.appendChild(btn);
                mxEvent.addListener(btn, "click", clickFn);
                bubble.appendChild(buttons);
              }

              if (data[2].length > 0) {
                bubble.appendChild(createDivForText(data[2]));
              }
            } else {
              waiting.innerHTML = "";
              bubble = waiting;
              waiting.scrollIntoView({
                behavior: "smooth",
                block: "end",
                inline: "nearest",
              });

              if (data == null) {
                mxUtils.write(bubble, mxResources.get("errShowingDiag"));
              } else {
                bubble.style.whiteSpace = "pre-wrap";
                bubble.appendChild(createDivForText(data[0]));
                bubble.appendChild(createDivForText(data[2]));
                bubble.appendChild(
                  createRetryButton(mxResources.get("refresh")),
                );
              }
            }

            bubble.scrollIntoView({
              behavior: "smooth",
              block: "end",
              inline: "nearest",
            });
          });
          console.log(publicChat, type, thePrompt);
          if (publicChat || type == "createPublic") {
            editorUi.generateOpenAiMermaidDiagram(
              thePrompt,
              function (xml) {
                handleResponse(["", xml, ""], thePrompt);
              },
              handleError,
              true,
            );
          } else {
            editorUi.createTimeout(
              editorUi.editor.generateTimeout,
              mxUtils.bind(this, function (timeout) {
                var handleErrorWithTimeout = mxUtils.bind(this, function (e) {
                  timeout.clear();
                  handleError(e);
                });

                var url = Editor.replacePlaceholders(config.endpoint, resolver);
                var req = new mxXmlRequest(url, JSON.stringify(params), "POST");

                req.setRequestHeaders = mxUtils.bind(
                  this,
                  function (request, params) {
                    request.setRequestHeader(
                      "Content-Type",
                      "application/json",
                    );

                    for (var key in config.requestHeaders) {
                      request.setRequestHeader(
                        key,
                        Editor.replacePlaceholders(
                          config.requestHeaders[key],
                          resolver,
                        ),
                      );
                    }
                  },
                );

                EditorUi.debug(
                  "EditorUi.ChatWindow.addMessage send",
                  "url",
                  url,
                  "params",
                  params,
                  "aiModel",
                  aiModel,
                  "config",
                  config,
                );

                req.send(
                  mxUtils.bind(this, function (req) {
                    if (timeout.clear()) {
                      try {
                        if (req.getStatus() >= 200 && req.getStatus() <= 299) {
                          var response = JSON.parse(req.getText());

                          console.log(response, config.responsePath);
                          var result = Editor.executeSimpleJsonPath(
                            response,
                            config.responsePath,
                          );

                          var text = mxUtils.trim(
                            result.length > 0 ? result[0] : req.getText(),
                          );
                          var mermaid =
                            editorUi.extractMermaidDeclaration(text);
                          EditorUi.debug(
                            "EditorUi.ChatWindow.addMessage response",
                            "params",
                            params,
                            "response",
                            response,
                            "text",
                            [text],
                            "mermaid",
                            [mermaid],
                          );

                          if (mermaid == null) {
                            console.log(mermaid, "mermaid not found");
                            handleResponse(
                              Editor.extractGraphModelFromText(text),
                              thePrompt,
                            );
                          } else {
                            console.log(mermaid, "mermaid");
                            editorUi.parseMermaidDiagram(
                              mermaid,
                              null,
                              mxUtils.bind(this, function (xml) {
                                handleResponse(["", xml, ""], thePrompt);
                              }),
                              mxUtils.bind(this, function (e) {
                                handleErrorWithTimeout(e);
                              }),
                              null,
                              true,
                            );
                          }
                        } else {
                          var result = "Error: " + req.getStatus();

                          try {
                            var resp = JSON.parse(req.getText());

                            if (
                              resp != null &&
                              resp.error != null &&
                              resp.error.message != null
                            ) {
                              result = resp.error.message;
                            }
                          } catch (e) {
                            // ignore
                          }

                          waiting.innerHTML = "";
                          mxUtils.write(waiting, result);
                          waiting.scrollIntoView({
                            behavior: "smooth",
                            block: "end",
                            inline: "nearest",
                          });
                        }
                      } catch (e) {
                        handleErrorWithTimeout(e);
                      }
                    }
                  }),
                  handleErrorWithTimeout,
                );
              }),
              function (e) {
                waiting.innerHTML = "";
                waiting.appendChild(createError(e.message));
                waiting.scrollIntoView({
                  behavior: "smooth",
                  block: "end",
                  inline: "nearest",
                });
                EditorUi.debug("EditorUi.ChatWindow.addMessage", "error", e);
              },
            );
          }
        });

        processMessage();
      }

      div.appendChild(user);

      function send() {
        if (mxUtils.trim(inp.value) != "") {
          try {
            addMessage(inp.value);
            inp.value = "";
          } catch (e) {
            EditorUi.debug("EditorUi.ChatWindow.send", "error", e);
          }
        }
      }

      mxEvent.addListener(sendImg, "click", send);

      mxEvent.addListener(inp, "keydown", function (evt) {
        if (evt.keyCode == 13 && !mxEvent.isShiftDown(evt)) {
          send();
        }
      });

      this.generate = mxUtils.bind(this, function (prompt) {
        inp.value = prompt;
        send();
      });

      this.window = new mxWindow(
        mxResources.get("generate"),
        div,
        x,
        y,
        w,
        h,
        true,
        true,
      );
      this.window.minimumSize = new mxRectangle(0, 0, 120, 100);
      this.window.destroyOnClose = false;
      this.window.setMaximizable(false);
      this.window.setResizable(true);
      this.window.setClosable(true);

      // Adds help icon to title bar
      if (!editorUi.isOffline()) {
        var icon = editorUi.createHelpIcon(
          "https://www.drawio.com/doc/faq/configure-ai-options",
        );
        icon.style.cursor = "help";
        icon.style.opacity = "0.5";
        this.window.buttons.insertBefore(icon, this.window.buttons.firstChild);
      }

      this.window.addListener(
        mxEvent.DESTROY,
        mxUtils.bind(this, function () {
          graph.getModel().removeListener(updateType);
        }),
      );

      this.window.addListener(
        "show",
        mxUtils.bind(this, function () {
          this.window.fit();
          inp.focus();
        }),
      );

      editorUi.installResizeHandler(this, true);
      editorUi.installResizeHandler(this, true);
    };

    // --- EXPOSE EditorUi INSTANCE ---
    // Hook into EditorUi.prototype.createUi which is called during
    // initialization of every EditorUi (and App, which extends it).
    // This avoids wrapping the App constructor (which breaks static
    // properties like App.main, App.initPluginCallback, etc.).
    var _origCreateUi = EditorUi.prototype.createUi;
    EditorUi.prototype.createUi = function () {
      window.__editorUi = this;
      console.log("[over-ride.js] EditorUi captured via createUi");
      return _origCreateUi.apply(this, arguments);
    };

    // --- AI XML MERGE HANDLER ---
    // Listens for 'mergeAiXml' postMessage from the parent window.
    // Uses graph.importCells() to ADD new cells at a free position
    // without replacing existing content or changing view settings.
    // This is the same pattern as the ChatWindow clickFn above.
    window.addEventListener("message", function (evt) {
      if (!evt.data || typeof evt.data !== "string") return;
      try {
        var msg = JSON.parse(evt.data);
        if (msg.action !== "mergeAiXml" || !msg.xml) return;

        console.log(
          "[over-ride.js] mergeAiXml received, xml length:",
          msg.xml.length,
        );

        var editorUi = window.__editorUi;
        console.log("[over-ride.js] __editorUi:", !!editorUi);

        if (!editorUi || !editorUi.editor || !editorUi.editor.graph) {
          console.warn("[over-ride.js] mergeAiXml: EditorUi not ready");
          (window.opener || window.parent).postMessage(
            JSON.stringify({ event: "mergeAiXml", success: false }),
            "*",
          );
          return;
        }

        var graph = editorUi.editor.graph;

        try {
          // Handle <mxfile><diagram>compressed</diagram></mxfile> format
          // (used by template files) by extracting <mxGraphModel> first.
          var xmlToProcess = msg.xml;
          try {
            var tmpDoc = mxUtils.parseXml(msg.xml);
            var tmpRoot = tmpDoc.documentElement;
            if (tmpRoot && tmpRoot.nodeName === "mxfile") {
              var extracted = Editor.extractGraphModel(tmpRoot);
              if (extracted) {
                xmlToProcess = mxUtils.getXml(extracted);
                console.log(
                  "[over-ride.js] Extracted mxGraphModel from mxfile",
                );
              }
            }
          } catch (parseErr) {
            console.log(
              "[over-ride.js] XML format detection fallback, using raw xml",
            );
          }

          // Parse XML to cell objects using draw.io's built-in parser
          var cells = editorUi.stringToCells(xmlToProcess);
          console.log(
            "[over-ride.js] stringToCells returned",
            cells ? cells.length : 0,
            "cells",
          );

          if (cells == null || cells.length === 0) {
            console.warn("[over-ride.js] mergeAiXml: No cells parsed from XML");
            return;
          }

          // Normalize cell bounding box to origin before inserting
          var bbox = graph.getBoundingBoxFromGeometry(cells);
          if (bbox) {
            editorUi.sidebar.graph.moveCells(cells, -bbox.x, -bbox.y);
          }

          // Find a position that doesn't overlap existing content
          var pt = graph.getFreeInsertPoint();
          console.log("[over-ride.js] Inserting at", pt.x, pt.y);

          // Add cells to the graph model — preserves everything existing
          graph.model.beginUpdate();
          try {
            graph.setSelectionCells(graph.importCells(cells, pt.x, pt.y));
          } finally {
            graph.model.endUpdate();
          }

          // Scroll to the newly inserted cells
          graph.scrollCellToVisible(graph.getSelectionCell());
          console.log("[over-ride.js] mergeAiXml: SUCCESS");

          // Notify parent of success
          (window.opener || window.parent).postMessage(
            JSON.stringify({ event: "mergeAiXml", success: true }),
            "*",
          );
        } catch (e) {
          console.error("[over-ride.js] mergeAiXml: Import failed", e);
          (window.opener || window.parent).postMessage(
            JSON.stringify({
              event: "mergeAiXml",
              success: false,
              error: e.message,
            }),
            "*",
          );
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    });

    // --- ADDED SAVE/LOAD LOGIC ---
    const urlParams = new URLSearchParams(window.location.search);
    const flowId = urlParams.get("id");

    // Override Save
    const oldSave = App.prototype.save;
    App.prototype.save = function (name, file, success, error) {
      if (flowId) {
        const xml = mxUtils.getXml(this.editor.getGraphXml());

        console.log(xml);
        fetch(`/api/flows/${flowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ xml: xml }),
        })
          .then((res) => res.json())
          .then((data) => {
            console.log("Flow saved:", data);
            if (success) success();
          })
          .catch((err) => {
            console.error("Save failed:", err);
            if (error) error(err);
          });
      } else {
        // For new flows, we might want to create a record first
        // or just fallback to default save
        oldSave.apply(this, arguments);
      }
    };
    //Editor save

    EditorUi.prototype.save = function (name) {
      console.log("Save");
      if (name != null) {
        if (this.editor.graph.isEditing()) {
          this.editor.graph.stopEditing();
        }

        var xml = mxUtils.getXml(this.editor.getGraphXml());

        try {
          if (Editor.useLocalStorage) {
            if (
              localStorage.getItem(name) != null &&
              !mxUtils.confirm(mxResources.get("replaceIt", [name]))
            ) {
              return;
            }

            localStorage.setItem(name, xml);

            this.updateStatus(
              mxUtils.bind(this, function () {
                this.editor.setStatus(
                  mxUtils.htmlEntities(mxResources.get("saved")) +
                    " " +
                    new Date(),
                );
              }),
            );
          } else {
            if (xml.length < MAX_REQUEST_SIZE) {
              new mxXmlRequest(
                SAVE_URL,
                "filename=" +
                  encodeURIComponent(name) +
                  "&xml=" +
                  encodeURIComponent(xml),
              ).simulate(document, "_blank");
            } else {
              mxUtils.alert(mxResources.get("drawingTooLarge"));
              mxUtils.popup(xml);

              return;
            }
          }

          this.editor.setModified(false);
          this.editor.setFilename(name);
          this.updateDocumentTitle();
        } catch (e) {
          this.updateStatus(
            mxUtils.bind(this, function () {
              this.editor.setStatus(
                mxUtils.htmlEntities(mxResources.get("errorSavingFile")),
              );
            }),
          );
        }
      }
    };
    // Load flow if ID exists
    if (flowId) {
      const originalOnLoad = App.prototype.onLoad;
      App.prototype.onLoad = function () {
        originalOnLoad.apply(this, arguments);
        fetch(`/api/flows/${flowId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.xml) {
              const doc = mxUtils.parseXml(data.xml);
              this.editor.setGraphXml(doc.documentElement);
            }
          })
          .catch((err) => console.error("Load failed:", err));
      };
    }
    // ------------------------------

    // ── ValueChart: custom Templates icon in left vertical sidebar ──
    // Three install paths:
    //  1) Monkey-patch EditorUi.prototype.createPickerMenuForTheme — catches
    //     future theme changes.
    //  2) If the App instance has already built the picker by the time we
    //     run, append directly on window.__editorUi.sketchPickerMenuElt.
    //  3) DOM retry fallback — poll for .geVerticalToolbar for up to 10s to
    //     cover the race where app.min.js finished first.
    // Dataset flag [data-vc-templates="1"] prevents duplicates.
    (function installVcTemplatesBtn() {
      function onClick(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        try {
          (window.opener || window.parent).postMessage(
            JSON.stringify({ action: "openTemplates" }),
            "*",
          );
          console.log("[VC] Templates clicked → openTemplates");
        } catch (err) {
          console.error("[VC] openTemplates postMessage failed", err);
        }
      }

      function buildButton() {
        var btn = document.createElement("a");
        btn.className = "geButton";
        btn.setAttribute("data-vc-templates", "1");
        btn.setAttribute("title", "Templates");
        btn.setAttribute("role", "button");
        btn.setAttribute("aria-label", "Templates");
        btn.innerHTML =
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="#3CB371" xmlns="http://www.w3.org/2000/svg">' +
          '<rect x="3"  y="3"  width="7" height="7" rx="1"/>' +
          '<rect x="14" y="3"  width="7" height="7" rx="1"/>' +
          '<rect x="3"  y="14" width="7" height="7" rx="1"/>' +
          '<rect x="14" y="14" width="7" height="7" rx="1"/>' +
          "</svg>";
        if (typeof mxEvent !== "undefined") {
          mxEvent.addListener(btn, "click", onClick);
        } else {
          btn.addEventListener("click", onClick);
        }
        return btn;
      }

      function appendTo(picker) {
        if (!picker) return false;
        if (picker.querySelector('[data-vc-templates="1"]')) return true;
        // Insert as the FIRST icon in the vertical toolbar
        picker.insertBefore(buildButton(), picker.firstChild);
        console.log(
          "[VC] Templates button prepended to",
          picker.className || picker.nodeName,
        );
        startGuardObserver(picker);
        return true;
      }

      // Re-insert our button whenever draw.io rebuilds the picker's children
      // (responsive resize or chevron expand). Skip when the toolbar is in
      // collapsed state (class .geCollapsedToolbar) — in that mode only the
      // chevron is rendered and our button must stay hidden like the rest.
      function startGuardObserver(picker) {
        if (!picker || picker.__vcGuardObserver) return;
        var obs = new MutationObserver(function () {
          if (picker.classList.contains("geCollapsedToolbar")) return;
          if (
            picker.children.length > 0 &&
            !picker.querySelector('[data-vc-templates="1"]')
          ) {
            picker.insertBefore(buildButton(), picker.firstChild);
            console.log("[VC] Templates button re-inserted after expand");
          }
        });
        obs.observe(picker, {
          childList: true,
          attributes: true,
          attributeFilter: ["class"],
        });
        picker.__vcGuardObserver = obs;
      }

      // Path 1 — prototype patch (future theme changes)
      if (
        typeof EditorUi !== "undefined" &&
        EditorUi.prototype.createPickerMenuForTheme
      ) {
        var __vcOrigCreatePickerMenu =
          EditorUi.prototype.createPickerMenuForTheme;
        EditorUi.prototype.createPickerMenuForTheme = function (theme) {
          __vcOrigCreatePickerMenu.apply(this, arguments);
          if (
            (theme === "sketch" || theme === "simple") &&
            this.sketchPickerMenuElt
          ) {
            appendTo(this.sketchPickerMenuElt);
          }
        };
        console.log("[VC] createPickerMenuForTheme patched");
      }

      // Path 2 — if picker already built on the live instance
      if (window.__editorUi && window.__editorUi.sketchPickerMenuElt) {
        appendTo(window.__editorUi.sketchPickerMenuElt);
        return;
      }

      // Path 3 — DOM retry poll (200ms × 50 = ~10s)
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        var picker =
          (window.__editorUi && window.__editorUi.sketchPickerMenuElt) ||
          document.querySelector(".geVerticalToolbar") ||
          document.querySelector(".geToolbarContainer.geVerticalToolbar");
        if (appendTo(picker) || tries > 50) {
          clearInterval(iv);
          if (tries > 50) {
            console.warn(
              "[VC] gave up looking for .geVerticalToolbar after 10s",
            );
          }
        }
      }, 200);
    })();
    // ────────────────────────────────────────────────────────────────

    // ── ValueChart: custom Shapes icon in left vertical sidebar ────
    // Mirror of the Templates button above — same three install paths,
    // same guard observer. Posts `{action: "openCustomShapes"}` up to
    // the React parent, which opens the CustomShapesPanel drawer.
    (function installVcShapesBtn() {
      function onClick(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        try {
          (window.opener || window.parent).postMessage(
            JSON.stringify({ action: "openCustomShapes" }),
            "*",
          );
          console.log("[VC] Shapes clicked → openCustomShapes");
        } catch (err) {
          console.error("[VC] openCustomShapes postMessage failed", err);
        }
      }

      function buildButton() {
        var btn = document.createElement("a");
        btn.className = "geButton";
        btn.setAttribute("data-vc-shapes", "1");
        btn.setAttribute("title", "Custom Shapes");
        btn.setAttribute("role", "button");
        btn.setAttribute("aria-label", "Custom Shapes");
        // Four-square shape-library icon (distinct from Templates 2x2)
        btn.innerHTML =
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3CB371" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">' +
          '<circle cx="7"  cy="7"  r="3"/>' +
          '<rect   x="14" y="4"  width="6" height="6" rx="1"/>' +
          '<polygon points="7,14 11,21 3,21"/>' +
          '<rect   x="14" y="14" width="6" height="6" rx="2" transform="rotate(45 17 17)"/>' +
          "</svg>";
        if (typeof mxEvent !== "undefined") {
          mxEvent.addListener(btn, "click", onClick);
        } else {
          btn.addEventListener("click", onClick);
        }
        return btn;
      }

      function appendTo(picker) {
        if (!picker) return false;
        if (picker.querySelector('[data-vc-shapes="1"]')) return true;
        // Insert right after the Templates button when present, otherwise
        // as the first icon.
        var tmpl = picker.querySelector('[data-vc-templates="1"]');
        if (tmpl && tmpl.nextSibling) {
          picker.insertBefore(buildButton(), tmpl.nextSibling);
        } else if (tmpl) {
          picker.appendChild(buildButton());
        } else {
          picker.insertBefore(buildButton(), picker.firstChild);
        }
        console.log(
          "[VC] Shapes button added to",
          picker.className || picker.nodeName,
        );
        startGuardObserver(picker);
        return true;
      }

      function startGuardObserver(picker) {
        if (!picker || picker.__vcShapesGuardObserver) return;
        var obs = new MutationObserver(function () {
          if (picker.classList.contains("geCollapsedToolbar")) return;
          if (
            picker.children.length > 0 &&
            !picker.querySelector('[data-vc-shapes="1"]')
          ) {
            // Re-insert after Templates if both are rebuilt together
            var tmpl = picker.querySelector('[data-vc-templates="1"]');
            if (tmpl && tmpl.nextSibling) {
              picker.insertBefore(buildButton(), tmpl.nextSibling);
            } else if (tmpl) {
              picker.appendChild(buildButton());
            } else {
              picker.insertBefore(buildButton(), picker.firstChild);
            }
            console.log("[VC] Shapes button re-inserted after expand");
          }
        });
        obs.observe(picker, {
          childList: true,
          attributes: true,
          attributeFilter: ["class"],
        });
        picker.__vcShapesGuardObserver = obs;
      }

      // Path 1 — prototype patch
      if (
        typeof EditorUi !== "undefined" &&
        EditorUi.prototype.createPickerMenuForTheme
      ) {
        var __vcOrigCreatePickerMenu2 =
          EditorUi.prototype.createPickerMenuForTheme;
        EditorUi.prototype.createPickerMenuForTheme = function (theme) {
          __vcOrigCreatePickerMenu2.apply(this, arguments);
          if (
            (theme === "sketch" || theme === "simple") &&
            this.sketchPickerMenuElt
          ) {
            appendTo(this.sketchPickerMenuElt);
          }
        };
      }

      // Path 2 — picker already built
      if (window.__editorUi && window.__editorUi.sketchPickerMenuElt) {
        appendTo(window.__editorUi.sketchPickerMenuElt);
        return;
      }

      // Path 3 — DOM retry poll
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        var picker =
          (window.__editorUi && window.__editorUi.sketchPickerMenuElt) ||
          document.querySelector(".geVerticalToolbar") ||
          document.querySelector(".geToolbarContainer.geVerticalToolbar");
        if (appendTo(picker) || tries > 50) {
          clearInterval(iv);
          if (tries > 50) {
            console.warn(
              "[VC] gave up looking for .geVerticalToolbar (Shapes btn) after 10s",
            );
          }
        }
      }, 200);
    })();
    // ────────────────────────────────────────────────────────────────

    // ── ValueChart: un-fade the picker icons after flow XML loads ──
    // On initial embed-mode boot, draw.io builds the picker while the
    // graph is still disabled (graph.isEnabled() === false), so every
    // icon renders with the `mxDisabled` class and looks faded. The
    // picker's rebuild function `p` is subscribed to `lockedChanged`
    // (see unmini.js line 286544), so firing that event after the graph
    // becomes enabled re-runs the rebuild and drops the faded state.
    // ── ValueChart: kill the draw.io status bar (top-right "Saved…") ──
    // Neuter every path that can render status text:
    //   • EditorUi.setStatusText, EditorUi.updateStatus, EditorUi.updateStatusAgain
    //   • Editor.setStatus
    //   • createStatusContainer still returns a div (other code appends to it)
    //     but styled to 0×0 and display:none.
    //   • DOM sweep: nuke any .geStatus / .geStatusAlert / [data-effect="fade"]
    //     already on the page, and keep sweeping for a few seconds.
    if (typeof EditorUi !== "undefined") {
      EditorUi.prototype.setStatusText = function () {};
      EditorUi.prototype.updateStatus = function () {};
      EditorUi.prototype.updateStatusAgain = function () {};

      var __vcOrigCreateStatus = EditorUi.prototype.createStatusContainer;
      EditorUi.prototype.createStatusContainer = function () {
        var el = __vcOrigCreateStatus
          ? __vcOrigCreateStatus.apply(this, arguments)
          : document.createElement("a");
        el.className = "geStatus vcHideStatus";
        el.style.cssText =
          "display:none !important;width:0 !important;height:0 !important;" +
          "padding:0 !important;margin:0 !important;pointer-events:none !important;";
        return el;
      };

      if (
        typeof Editor !== "undefined" &&
        Editor.prototype &&
        Editor.prototype.setStatus
      ) {
        Editor.prototype.setStatus = function () {};
      }

      // Inject hard CSS into the iframe document — covers any node class
      // draw.io reuses for status (footer-bar toast, menubar status, and
      // the parent .geMenubarContainer which reserves empty vertical space
      // when the status child is the only thing inside).
      var __vcStatusStyle = document.createElement("style");
      __vcStatusStyle.textContent =
        ".geStatus, .geStatusAlert, .geStatusMessage, " +
        '[data-effect="fade"], .geBaseStatusBar, .geStatusFooter { ' +
        "display:none !important; visibility:hidden !important; " +
        "width:0 !important; height:0 !important; padding:0 !important; " +
        "margin:0 !important; pointer-events:none !important; } " +
        ".geMenubarContainer { " +
        "display:none !important; height:0 !important; min-height:0 !important; " +
        "padding:0 !important; margin:0 !important; border:none !important; }";
      document.head.appendChild(__vcStatusStyle);

      // Live DOM sweep — repeatedly nuke any leftover status node and the
      // .geMenubarContainer bar (empty strip under our navbar) until draw.io
      // is done initialising.
      function __vcSweepStatus() {
        document
          .querySelectorAll(
            '.geStatus, .geStatusAlert, .geStatusMessage, [data-effect="fade"]',
          )
          .forEach(function (el) {
            el.style.cssText =
              "display:none !important;width:0 !important;height:0 !important;" +
              "padding:0 !important;margin:0 !important;pointer-events:none !important;";
            el.innerHTML = "";
          });
        document.querySelectorAll(".geMenubarContainer").forEach(function (el) {
          el.style.cssText =
            "display:none !important;height:0 !important;min-height:0 !important;" +
            "padding:0 !important;margin:0 !important;border:none !important;";
        });
      }
      __vcSweepStatus();
      [100, 500, 1000, 2000, 4000].forEach(function (ms) {
        setTimeout(__vcSweepStatus, ms);
      });

      // Hide live instance's current statusContainer if one exists
      if (window.__editorUi && window.__editorUi.statusContainer) {
        window.__editorUi.statusContainer.style.cssText =
          "display:none !important;width:0 !important;height:0 !important;" +
          "padding:0 !important;margin:0 !important;pointer-events:none !important;";
        window.__editorUi.statusContainer.innerHTML = "";
      }

      console.log("[VC] status bar neutered (prototype + DOM sweep)");
    }
    // ────────────────────────────────────────────────────────────────

    // ── ValueFlowSoft branding & PDF print interception ──────────────
    // 1) Override visible draw.io brand strings via mxResources so any
    //    UI element built from these keys (menus, dialogs, tooltips,
    //    error messages) reads "ValueFlowSoft" instead of "draw.io".
    if (typeof mxResources !== "undefined" && mxResources.resources) {
      var __vcResourceOverrides = {
        untitledDiagram: "valuechart-flow",
        untitledLibrary: "valuechart-library",
        aboutDrawio: "About ValueFlowSoft",
        "draw.io": "ValueFlowSoft",
        drawioForWork: "ValueFlowSoft",
        hateApp: "I dislike ValueFlowSoft",
      };
      Object.keys(__vcResourceOverrides).forEach(function (k) {
        mxResources.resources[k] = __vcResourceOverrides[k];
      });
    }

    // 2) Default filename → "valuechart-flow". Wraps EditorUi.init so the
    //    override survives later assignments inside dependsOnLanguage().
    if (typeof EditorUi !== "undefined") {
      var __vcDefaultName = window.VFS_DEFAULT_FILENAME || "valuechart-flow";

      // Helper: route a PDF export to the browser print dialog instead of
      // the broken EXPORT_URL server roundtrip. Used by every PDF code
      // path we override below.
      var __vcRouteToPrint = function (ui) {
        try {
          var print =
            ui && ui.actions && ui.actions.get && ui.actions.get("print");
          if (print && typeof print.funct === "function") {
            print.funct();
            return true;
          }
        } catch (e) {}
        try {
          window.print();
          return true;
        } catch (e) {}
        return false;
      };

      var __vcOrigInit = EditorUi.prototype.init;
      EditorUi.prototype.init = function () {
        if (__vcOrigInit) __vcOrigInit.apply(this, arguments);
        try {
          this.defaultFilename = __vcDefaultName;
          this.defaultLibraryName = "valuechart-library";
        } catch (e) {}
        // Replace the registered exportPdf action's funct so menu clicks
        // that go via this.actions.get('exportPdf') trigger print.
        try {
          var self = this;
          ["exportPdf", "exportPDF", "pdf"].forEach(function (name) {
            var act =
              self.actions && self.actions.get && self.actions.get(name);
            if (act)
              act.funct = function () {
                __vcRouteToPrint(self);
              };
          });
        } catch (e) {}
      };

      // Detect whether a real export server is wired up.
      // EXPORT_URL = "/api/export-proxy" → server available (or 503 → fallback below).
      // EXPORT_URL = "/api/export-disabled" or missing → always use print.
      var __vcExportServerConfigured =
        typeof window.EXPORT_URL === "string" &&
        window.EXPORT_URL !== "" &&
        window.EXPORT_URL.indexOf("disabled") === -1;

      // 3a) PDF export path through exportFile(format).
      //     When the export server is configured, let draw.io handle the
      //     request normally (it will POST to EXPORT_URL). If the server
      //     returns an error or is unreachable we fall back to print.
      //     When no server is configured, always route to print.
      var __vcOrigExportFile = EditorUi.prototype.exportFile;
      EditorUi.prototype.exportFile = function (format) {
        var fmt = (format || "").toString().toLowerCase();
        if (fmt === "pdf" && !__vcExportServerConfigured) {
          __vcRouteToPrint(this);
          return;
        }
        if (__vcOrigExportFile) {
          return __vcOrigExportFile.apply(this, arguments);
        }
      };

      // 3b) saveRequest path (File→Export As→PDF and Export PDF dialog).
      //     Same logic — only intercept when no export server is configured.
      var __vcOrigSaveRequest = EditorUi.prototype.saveRequest;
      EditorUi.prototype.saveRequest = function (filename, format) {
        var fmt = (format || "").toString().toLowerCase();
        if (fmt === "pdf" && !__vcExportServerConfigured) {
          __vcRouteToPrint(this);
          return;
        }
        if (__vcOrigSaveRequest) {
          return __vcOrigSaveRequest.apply(this, arguments);
        }
      };
    }

    // 4) Document title + brand-color scrollbars.
    try {
      document.title = "ValueFlowSoft";
    } catch (e) {}

    var __vcBrandStyle = document.createElement("style");
    __vcBrandStyle.id = "vfs-branding";
    __vcBrandStyle.textContent =
      "::-webkit-scrollbar{width:6px;height:6px;}" +
      "::-webkit-scrollbar-track{background:#f5f5f5;}" +
      "::-webkit-scrollbar-thumb{background:#3CB371;border-radius:3px;}" +
      "::-webkit-scrollbar-thumb:hover{background:#2d9e5a;}";
    document.head.appendChild(__vcBrandStyle);
    // ────────────────────────────────────────────────────────────────

    // ── Custom Save / Share dialog interception ─────────────────────
    // Replace draw.io's native "Save As" and "Share Link" dialogs with
    // ValueCharts' Ant Design modals. The parent React app receives a
    // postMessage and renders its own UI. Pass-through any non-dialog
    // save (forceDialog=false) so autosave / Ctrl-S still work.
    if (typeof App !== "undefined" && App.prototype) {
      var __vcOrigSaveFile = App.prototype.saveFile;
      App.prototype.saveFile = function (forceDialog, success) {
        if (forceDialog) {
          var file = this.getCurrentFile && this.getCurrentFile();
          var xml = "";
          try {
            if (typeof this.getFileData === "function") {
              xml = this.getFileData(true);
            }
          } catch (e) {}
          var currentName =
            (file && typeof file.getTitle === "function" && file.getTitle()) ||
            this.defaultFilename ||
            "valuechart-flow";
          try {
            window.parent.postMessage(
              JSON.stringify({
                event: "showSaveDialog",
                xml: xml,
                currentName: currentName,
              }),
              "*",
            );
          } catch (e) {}
          return;
        }
        if (__vcOrigSaveFile) {
          return __vcOrigSaveFile.apply(this, arguments);
        }
      };
    }

    if (typeof EditorUi !== "undefined" && EditorUi.prototype) {
      // Overrides File → Export As → URL and any other publish-link
      // entry point so ValueCharts URLs are shown instead of
      // diagrams.net viewer URLs.
      EditorUi.prototype.showPublishLinkDialog = function () {
        try {
          window.parent.postMessage(
            JSON.stringify({ event: "showShareDialog" }),
            "*",
          );
        } catch (e) {}
      };
    }
    // ────────────────────────────────────────────────────────────────

    // ── Custom Import dialog interception (Session 3) ───────────────
    // Replace draw.io's native device-file picker and cloud "pickFile"
    // dialogs with our Ant Design Import modal. The parent React app
    // reads the file and posts the parsed XML back via the existing
    // `load` action.
    if (typeof EditorUi !== "undefined" && EditorUi.prototype) {
      EditorUi.prototype.importLocalFile = function () {
        try {
          window.parent.postMessage(
            JSON.stringify({ event: "showImportDialog" }),
            "*",
          );
        } catch (e) {}
      };
    }
    if (typeof App !== "undefined" && App.prototype) {
      App.prototype.pickFile = function () {
        try {
          window.parent.postMessage(
            JSON.stringify({ event: "showImportDialog" }),
            "*",
          );
        } catch (e) {}
      };
    }
    // ────────────────────────────────────────────────────────────────

    (function unfadePickerOnEnable() {
      function triggerRebuild(ui) {
        try {
          ui.fireEvent(new mxEventObject("lockedChanged"));
        } catch (e) {}
      }
      function attach() {
        var ui = window.__editorUi;
        if (!ui || !ui.editor || !ui.editor.graph) return false;
        var graph = ui.editor.graph;
        // If already enabled, fire once to fix initial render
        if (graph.isEnabled()) triggerRebuild(ui);
        graph.addListener(
          (typeof mxEvent !== "undefined" && mxEvent.ENABLED_CHANGED) ||
            "enabledChanged",
          function () {
            triggerRebuild(ui);
          },
        );
        console.log("[VC] enabled-change listener attached");
        return true;
      }
      if (!attach()) {
        var n = 0;
        var t = setInterval(function () {
          if (attach() || ++n > 50) clearInterval(t);
        }, 200);
      }
    })();
  } else {
    // Retry after a short delay if App is not yet defined
    setTimeout(extendApp, 100);
  }
}

extendApp();
