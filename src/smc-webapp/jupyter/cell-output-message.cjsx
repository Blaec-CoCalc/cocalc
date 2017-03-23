misc = require('smc-util/misc')

{React, ReactDOM, rclass, rtypes}  = require('../smc-react')
{ImmutablePureRenderMixin, Markdown} = require('../r_misc')
{sanitize_html} = require('../misc_page')

LEFT='17px'

STDOUT_STYLE =
    whiteSpace    : 'pre-wrap'
    fontFamily    : 'monospace'
    paddingTop    : '5px'
    paddingBottom : '5px'
    paddingLeft   : LEFT

STDERR_STYLE = misc.merge({backgroundColor:'#fdd'}, STDOUT_STYLE)

Stdout = rclass
    propTypes :
        message : rtypes.immutable.Map.isRequired

    mixins: [ImmutablePureRenderMixin]

    render: ->
        <div style={STDOUT_STYLE}>
            {@props.message.get('text')}
        </div>

Stderr = rclass
    propTypes :
        message : rtypes.immutable.Map.isRequired

    mixins: [ImmutablePureRenderMixin]

    render: ->
        <div style={STDERR_STYLE}>
            {@props.message.get('text')}
        </div>

Image = rclass
    propTypes:
        extension : rtypes.string.isRequired
        sha1      : rtypes.string.isRequired
        actions   : rtypes.object.isRequired

    render: ->
        src = @props.actions.store.get_blob_url(@props.extension, @props.sha1)
        <img src={src} />

# This doesn't work at all yet for mathjax, etc.
HTML = rclass
    propTypes :
        value : rtypes.string.isRequired

    componentDidMount: ->
        $(ReactDOM.findDOMNode(@)).mathjax()

    to_html: ->
        # TODO -- much more sophisticated... see r_misc Markdown, etc.
        # e.g., also need to eval javascript when trusted but not otherwise.
        html_sane = sanitize_html(@props.value)
        return {__html: html_sane}

    render: ->
        <div
            style                   = {marginTop : '5px'}
            dangerouslySetInnerHTML = {@to_html()}
            >
        </div>

Data = rclass
    propTypes :
        message : rtypes.immutable.Map.isRequired
        actions : rtypes.object.isRequired

    mixins: [ImmutablePureRenderMixin]

    render: ->
        type  = undefined
        value = undefined
        @props.message.get('data').forEach (v, k) ->
            type  = k
            value = v
            return false

        [a, b] = type.split('/')
        switch a
            when 'text'
                switch b
                    when 'plain'
                        return <div style={STDOUT_STYLE}>{value}</div>
                    when 'html'
                        return <HTML value={value}/>
                    when 'markdown'
                        s = @props.actions.store
                        return <Markdown
                                value      = {value}
                                project_id = {s.get_project_id()}
                                file_path  = {s.get_directory()}
                            />
            when 'image'
                return <Image actions={@props.actions} extension={type.split('/')[1].split('+')[0]} sha1={value}/>

        return <pre>Unsupported message: {JSON.stringify(@props.message.toJS())}</pre>

Ansi = require('ansi-to-react')

Traceback = rclass
    propTypes :
        message : rtypes.immutable.Map.isRequired

    mixins: [ImmutablePureRenderMixin]

    render: ->
        v = []
        n = 0
        @props.message.get('traceback').forEach (x) ->
            v.push(<Ansi key={n}>{x}</Ansi>)
            n += 1
            return
        <div style={STDOUT_STYLE}>
            {v}
        </div>


NotImplemented = rclass
    propTypes :
        message : rtypes.immutable.Map.isRequired

    mixins: [ImmutablePureRenderMixin]

    render: ->
        <pre style={STDERR_STYLE}>
            {JSON.stringify(@props.message.toJS())}
        </pre>



message_component = (message) ->
    if message.get('name') == 'stdout'
        return Stdout
    if message.get('name') == 'stderr'
        return Stderr
    if message.get('data')?
        return Data
    if message.get('traceback')?
        return Traceback
    return NotImplemented

CellOutputMessage = rclass
    propTypes :
        message : rtypes.immutable.Map.isRequired
        actions   : rtypes.object.isRequired

    mixins: [ImmutablePureRenderMixin]

    render: ->
        C = message_component(@props.message)
        <C message={@props.message} actions={@props.actions} />

exports.CellOutputMessages = rclass
    propTypes :
        output  : rtypes.immutable.Map.isRequired  # the actual messages
        actions : rtypes.object.isRequired

    shouldComponentUpdate: (next) ->
        return next.output != @props.output

    render_output_message: (n, mesg) ->
        if not mesg?
            return
        <CellOutputMessage
            key     = {n}
            message = {mesg}
            actions   = {@props.actions}
        />

    message_list: ->
        v = []
        k = 0
        # TODO: use caching to make this more efficient...
        # combine stdout and stderr messages...
        for n in [0...@props.output.size]
            mesg = @props.output.get("#{n}")
            if not mesg?
                continue
            name = mesg.get('name')
            if k > 0 and (name == 'stdout' or name == 'stderr') and v[k-1].get('name') == name
                v[k-1] = v[k-1].set('text', v[k-1].get('text') + mesg.get('text'))
            else
                v[k] = mesg
                k += 1
        return v

    render: ->
        v = (@render_output_message(n, mesg) for n, mesg of @message_list())
        <div style={width:'100%', lineHeight:'normal', backgroundColor: '#fff', border: 0, marginBottom:0}>
            {v}
        </div>
